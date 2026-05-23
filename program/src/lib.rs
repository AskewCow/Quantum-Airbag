use anchor_lang::prelude::*;

declare_id!("J7gxnojav3SRfJxHhFGsW2iATBV4zVUsrkcKNzauPqRa");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PQC_PUBKEY_LEN: usize = 1952; // ML-DSA-65 public key size in bytes

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

#[program]
pub mod quantum_airbag {
    use super::*;

    /// Initialize the global algorithm registry PDA.
    /// Must be called once before any withdrawals can occur.
    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        sentinel_authority: Pubkey,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.algo_registry;
        registry.authority = ctx.accounts.authority.key();
        registry.sentinel_authority = sentinel_authority;
        registry.active_mask = u64::MAX; // All algorithms active initially
        registry.bump = ctx.bumps.algo_registry;
        msg!(
            "Algorithm registry initialized by {} at slot {}",
            ctx.accounts.authority.key(),
            Clock::get()?.slot
        );
        Ok(())
    }

    /// Create and initialise the vault PDA for the caller. Must be called once
    /// before the first deposit.
    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.bump = ctx.bumps.vault;
        vault.algo_version = AlgoVersion::MlDsa65;
        vault.mode = VaultMode::Normal;
        vault.balance = 0;
        Ok(())
    }

    /// Move SOL from an Ed25519 wallet into the PDA vault.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InsufficientBalance);

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &ctx.accounts.vault.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.vault.to_account_info(),
            ],
        )?;

        ctx.accounts.vault.balance = ctx.accounts.vault.balance.checked_add(amount).unwrap();
        Ok(())
    }

    /// Withdraw SOL from the vault.
    ///
    /// In Normal mode: requires a valid PQC signature (dispatched via algo_version).
    /// In Lockdown mode: Ed25519 callers are rejected; only a PQC-authenticated
    /// request is accepted (same dispatch path, mode flag blocks anything else).
    ///
    /// CRITICAL: never hardcode a specific PQC algorithm here. All verification
    /// routes through dispatch_pqc_verify, which reads algo_version from the
    /// vault account.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64, pqc_sig_hash: [u8; 32]) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let registry = &ctx.accounts.algo_registry;

        // Check algorithm is not banned before any verification
        require!(
            registry.is_active(vault.algo_version),
            VaultError::AlgorithmBanned
        );

        // In Lockdown, reject any call that didn't arrive with a PQC credential
        // (the pqc_sig_hash commitment must be non-zero)
        if vault.mode == VaultMode::Lockdown {
            require!(pqc_sig_hash != [0u8; 32], VaultError::VaultInLockdown);
        }

        // Dispatch PQC verification — reads algo_version, never hardcoded
        dispatch_pqc_verify(vault.algo_version, &vault.pqc_pubkey, &pqc_sig_hash)?;

        require!(amount <= vault.balance, VaultError::InsufficientBalance);

        let vault_account = vault.to_account_info();
        **vault_account.try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;

        let vault = &mut ctx.accounts.vault;
        vault.balance -= amount;
        Ok(())
    }

    /// Store an ML-DSA public key in the vault account.
    pub fn register_pqc_key(ctx: Context<RegisterPqcKey>, pqc_pubkey: Vec<u8>) -> Result<()> {
        require!(
            pqc_pubkey.len() == PQC_PUBKEY_LEN,
            VaultError::InvalidPqcSignature
        );
        let vault = &mut ctx.accounts.vault;
        vault.pqc_pubkey = pqc_pubkey.try_into().map_err(|_| VaultError::InvalidPqcSignature)?;
        Ok(())
    }

    /// Flip the vault to Lockdown mode. Callable only by the sentinel authority.
    ///
    /// This instruction has no withdrawal power. A compromised sentinel can
    /// cause a false lockdown (inconvenience) but cannot steal funds.
    pub fn migrate(ctx: Context<Migrate>) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.algo_registry.sentinel_authority,
            VaultError::UnauthorisedAuthority
        );
        let vault = &mut ctx.accounts.vault;
        vault.mode = VaultMode::Lockdown;
        msg!(
            "Vault {} locked down by sentinel at slot {}",
            vault.key(),
            Clock::get()?.slot
        );
        Ok(())
    }

    /// Update the algorithm version stored in the vault account.
    ///
    /// This is the user-facing crypto-agility mechanism. Changing algo_version
    /// causes all future dispatch_pqc_verify calls to route through the new
    /// algorithm. No fund movement required.
    pub fn rotate_algorithm(ctx: Context<RotateAlgorithm>, new_version: AlgoVersion) -> Result<()> {
        let registry = &ctx.accounts.algo_registry;
        require!(registry.is_active(new_version), VaultError::AlgorithmBanned);
        let vault = &mut ctx.accounts.vault;
        vault.algo_version = new_version;
        Ok(())
    }

    /// Mark an algorithm as Banned in the global registry PDA.
    ///
    /// One transaction, instant effect across every vault in the system.
    /// Only callable by the registry authority.
    pub fn ban_algorithm(ctx: Context<BanAlgorithm>, version: AlgoVersion) -> Result<()> {
        let registry = &mut ctx.accounts.algo_registry;
        registry.set_banned(version);
        msg!(
            "Algorithm {:?} banned at slot {} by {}",
            version,
            Clock::get()?.slot,
            ctx.accounts.authority.key()
        );
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Dispatch table — never call a PQC algorithm directly outside this function
// ---------------------------------------------------------------------------

fn dispatch_pqc_verify(
    algo: AlgoVersion,
    pubkey: &[u8; PQC_PUBKEY_LEN],
    sig_hash: &[u8; 32],
) -> Result<()> {
    match algo {
        AlgoVersion::MlDsa65 => verify_ml_dsa_65(pubkey, sig_hash),
        // New variants: add a match arm here. No other changes needed.
    }
}

fn verify_ml_dsa_65(_pubkey: &[u8; PQC_PUBKEY_LEN], _sig_hash: &[u8; 32]) -> Result<()> {
    // TODO (Step 2): replace with real Dilithium3 verification.
    //
    // Prototype uses off-chain verification + hash commitment because
    // Dilithium3 signatures (2.4KB) exceed Solana's 1232-byte transaction limit.
    // Production path: ZK proof of the Dilithium signature.
    //
    // For now: a non-zero hash is treated as a valid commitment.
    require!(_sig_hash != &[0u8; 32], VaultError::InvalidPqcSignature);
    Ok(())
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + AlgoRegistry::INIT_SPACE,
        seeds = [b"algo_registry"],
        bump
    )]
    pub algo_registry: Account<'info, AlgoRegistry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + VaultAccount::INIT_SPACE,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Box<Account<'info, VaultAccount>>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = owner
    )]
    pub vault: Box<Account<'info, VaultAccount>>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = owner
    )]
    pub vault: Box<Account<'info, VaultAccount>>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [b"algo_registry"], bump)]
    pub algo_registry: Account<'info, AlgoRegistry>,
}

#[derive(Accounts)]
pub struct RegisterPqcKey<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = owner
    )]
    pub vault: Box<Account<'info, VaultAccount>>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct Migrate<'info> {
    #[account(mut)]
    pub vault: Box<Account<'info, VaultAccount>>,
    pub authority: Signer<'info>,
    #[account(seeds = [b"algo_registry"], bump)]
    pub algo_registry: Account<'info, AlgoRegistry>,
}

#[derive(Accounts)]
pub struct RotateAlgorithm<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = owner
    )]
    pub vault: Box<Account<'info, VaultAccount>>,
    pub owner: Signer<'info>,
    #[account(seeds = [b"algo_registry"], bump)]
    pub algo_registry: Account<'info, AlgoRegistry>,
}

#[derive(Accounts)]
pub struct BanAlgorithm<'info> {
    #[account(
        mut,
        seeds = [b"algo_registry"],
        bump,
        has_one = authority
    )]
    pub algo_registry: Account<'info, AlgoRegistry>,
    pub authority: Signer<'info>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct VaultAccount {
    pub owner: Pubkey,
    pub pqc_pubkey: [u8; PQC_PUBKEY_LEN],
    pub algo_version: AlgoVersion,
    pub mode: VaultMode,
    pub balance: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AlgoRegistry {
    pub authority: Pubkey,
    pub sentinel_authority: Pubkey,
    /// Bitmask: bit N = 1 means AlgoVersion N is Active, 0 = Banned
    pub active_mask: u64,
    pub bump: u8,
}

impl AlgoRegistry {
    pub fn is_active(&self, algo: AlgoVersion) -> bool {
        let bit = algo as u64;
        self.active_mask & (1 << bit) != 0
    }

    pub fn set_banned(&mut self, algo: AlgoVersion) {
        let bit = algo as u64;
        self.active_mask &= !(1 << bit);
    }
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum AlgoVersion {
    MlDsa65 = 0,
    // Future variants: add here. Ban old ones via ban_algorithm. No migration needed.
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum VaultMode {
    Normal,
    Lockdown,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum VaultError {
    #[msg("Algorithm is banned in the registry")]
    AlgorithmBanned,
    #[msg("PQC signature is invalid")]
    InvalidPqcSignature,
    #[msg("Caller is not the authorised sentinel")]
    UnauthorisedAuthority,
    #[msg("Vault is in Lockdown — Ed25519 withdrawals are blocked")]
    VaultInLockdown,
    #[msg("Insufficient vault balance")]
    InsufficientBalance,
}
