export enum IdentityStatus {
    None,
    Confirmed,
    Unconfirmed,
}

export interface Data {
    accounts: Account[];
    rewards: Reward[];
}

export interface Account {
    id: string;
    address: string;
    parent_account_id: string | undefined;
    identity: Identity | undefined;
    child_display: string | undefined;
}

export interface Identity {
    display: string;
    email: string | undefined;
    twitter: string | undefined;
    web: string | undefined;
    confirmed: boolean;
}

export interface Reward {
    validator_account_id: string;
    total_reward: bigint;
}

export interface Network {
    name: string;
    ticker: string;
    ss58Prefix: number;
    decimals: number;
    dataURL: string;
}

export const KUSAMA: Network = {
    name: 'Kusama',
    ticker: 'KSM',
    ss58Prefix: 2,
    decimals: 12,
    dataURL: 'https://api.kusama.subvt.io:17900/validator/reward/chart',
};

export const POLKADOT: Network = {
    name: 'Polkadot',
    ticker: 'DOT',
    ss58Prefix: 0,
    decimals: 10,
    dataURL: 'https://api.polkadot.subvt.io:18900/validator/reward/chart',
};

export interface Entry {
    accountIdHex: string;
    address: string;
    display: string;
    identityStatus: IdentityStatus;
    total: bigint;
    subs: Entry[];
    isExpanded: boolean;
}
