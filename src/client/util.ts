import { Keyring } from '@polkadot/keyring';

const KEYRING = new Keyring();
const THOUSANDS_SEPARATOR = ',';
const DECIMAL_SEPARATOR = '.';

export function getSS58Address(accountIdHex: string, ss58Prefix: number) {
    return KEYRING.encodeAddress(accountIdHex, ss58Prefix);
}

export function truncateSS58Address(address: string) {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function insertAtIndex(actual: string, index: number, insert: string): string {
    return actual.substring(0, index) + insert + actual.substring(index);
}

export function formatNumber(
    value: bigint,
    decimals: number,
    formatDecimals: number,
    ticker?: string
): string {
    let formatted = value.toString();
    while (formatted.length < decimals + 1) {
        formatted = '0' + formatted;
    }
    formatted = formatted.substring(0, formatted.length - decimals + formatDecimals);
    let integerPart = formatted.substring(0, formatted.length - formatDecimals);
    for (let i = integerPart.length - 3; i > 0; i -= 3) {
        integerPart = insertAtIndex(integerPart, i, THOUSANDS_SEPARATOR);
    }

    const decimalPart = formatted.substring(formatted.length - formatDecimals);
    formatted = `${integerPart}${DECIMAL_SEPARATOR}${decimalPart}`;
    if (ticker) {
        return `${formatted} ${ticker}`;
    } else {
        return formatted;
    }
}
