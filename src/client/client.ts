import { IdentityStatus, Network, KUSAMA, POLKADOT, Entry, Data, Account } from './types';
import { formatNumber, getSS58Address, truncateSS58Address } from './util';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface UI {
    pageSpinner: HTMLElement;
    loadingStatus: HTMLElement;
    startDate: HTMLInputElement;
    endDate: HTMLInputElement;
    kusamaSelector: HTMLInputElement;
    polkadotSelector: HTMLInputElement;
    identityOnlyCheckbox: HTMLInputElement;
    validatorList: HTMLTableElement;
}

class RichValidator {
    private readonly ui: UI;
    private network: Network = KUSAMA;
    private startDate: Date = new Date();
    private endDate: Date = new Date();
    private entries: Entry[] = [];
    private withIdentityOnly = true;

    constructor() {
        this.ui = {
            pageSpinner: <HTMLElement>document.getElementById('page-spinner'),
            loadingStatus: <HTMLElement>document.getElementById('loading-status'),
            startDate: <HTMLInputElement>document.getElementById('start-date'),
            endDate: <HTMLInputElement>document.getElementById('end-date'),
            kusamaSelector: <HTMLInputElement>document.getElementById('kusama-selector'),
            polkadotSelector: <HTMLInputElement>document.getElementById('polkadot-selector'),
            identityOnlyCheckbox: <HTMLInputElement>(
                document.getElementById('identity-only-checkbox')
            ),
            validatorList: <HTMLTableElement>document.getElementById('validator-list'),
        };
        this.ui.startDate.addEventListener('change', async (_event) => {
            this.startDate = new Date(this.ui.startDate.value);
            this.adjustDates();
            this.getData();
        });
        this.ui.endDate.addEventListener('change', async (_event) => {
            this.endDate = new Date(this.ui.endDate.value);
            this.adjustDates();
            this.getData();
        });
        this.ui.kusamaSelector.addEventListener('change', async (_event) => {
            if (this.ui.kusamaSelector.checked) {
                this.network = KUSAMA;
                this.getData();
            }
        });
        this.ui.polkadotSelector.addEventListener('change', async (_event) => {
            if (this.ui.polkadotSelector.checked) {
                this.network = POLKADOT;
                this.getData();
            }
        });
        this.ui.identityOnlyCheckbox.addEventListener('change', async (_event) => {
            this.withIdentityOnly = this.ui.identityOnlyCheckbox.checked;
            this.displayEntries();
        });
    }

    private adjustDates() {
        if (this.startDate.getFullYear() < 2022) {
            this.startDate = new Date(2022, 0, 1);
        }
        if (this.endDate.getTime() - this.startDate.getTime() < ONE_DAY_MS) {
            this.endDate.setTime(this.startDate.getTime() + ONE_DAY_MS);
        }
        this.displayDates();
    }

    private displayDates() {
        this.displayDate(this.startDate, this.ui.startDate);
        this.displayDate(this.endDate, this.ui.endDate);
    }

    private displayDate(date: Date, control: HTMLInputElement) {
        const startYear = date.getFullYear();
        const startMonth = date.getMonth() + 1;
        const startDay = date.getDate();
        const startMonthString = (startMonth < 10 ? '0' : '') + startMonth;
        const startDayString = (startDay < 10 ? '0' : '') + startDay;
        const today = startYear + '-' + startMonthString + '-' + startDayString;
        control.value = today;
    }

    private lockControls() {
        this.ui.startDate.disabled = true;
        this.ui.endDate.disabled = true;
        this.ui.kusamaSelector.disabled = true;
        this.ui.polkadotSelector.disabled = true;
        this.ui.identityOnlyCheckbox.disabled = true;
    }

    private unlockControls() {
        this.ui.startDate.disabled = false;
        this.ui.endDate.disabled = false;
        this.ui.kusamaSelector.disabled = false;
        this.ui.polkadotSelector.disabled = false;
        this.ui.identityOnlyCheckbox.disabled = false;
    }

    async init() {
        this.startDate = new Date(new Date().getFullYear(), 0, 1);
        this.displayDates();
        await this.getData();
    }

    private async getData() {
        this.lockControls();
        this.ui.pageSpinner.style.display = 'block';
        this.ui.loadingStatus.style.display = 'inline';
        this.ui.loadingStatus.innerHTML = 'Loading data...';
        this.entries = [];
        this.ui.validatorList.innerHTML = '';
        try {
            const data: Data = await (
                await fetch(
                    this.network.dataURL +
                        '?' +
                        new URLSearchParams({
                            start_timestamp: this.startDate.getTime().toString(),
                            end_timestamp: this.endDate.getTime().toString(),
                        }).toString(),
                    {
                        method: 'GET',
                        headers: {},
                    }
                )
            ).json();
            this.ui.pageSpinner.style.display = 'none';
            this.ui.loadingStatus.style.display = 'none';
            this.processChartData(data);
            this.unlockControls();
        } catch (error) {
            if (confirm('Error while loading data: ' + error + '\n\nDo you want to retry?')) {
                this.getData();
            } else {
                this.unlockControls();
            }
        }
    }

    private processChartData(data: Data) {
        for (const reward of data.rewards) {
            const account = data.accounts.find(
                (account: Account) => account.id == reward.validator_account_id
            );
            if (!account) {
                continue;
            }
            const address = getSS58Address(reward.validator_account_id, this.network.ss58Prefix);
            let display = truncateSS58Address(address);
            let identityStatus: IdentityStatus = IdentityStatus.None;
            if (
                account.parent_account_id &&
                account.parent_account_id != account.id &&
                account.child_display
            ) {
                display = account.child_display;
            } else if (account.identity) {
                display = account.identity.display;
                identityStatus = account.identity.confirmed
                    ? IdentityStatus.Confirmed
                    : IdentityStatus.Unconfirmed;
            }
            const entry: Entry = {
                accountIdHex: reward.validator_account_id,
                address,
                display,
                identityStatus,
                total: reward.total_reward,
                subs: [],
                isExpanded: false,
            };
            const existingEntry = this.entries.find(
                (searchEntry) => searchEntry.accountIdHex == reward.validator_account_id
            );
            if (existingEntry) {
                existingEntry.total += entry.total;
                existingEntry.subs.push(entry);
                this.entries = this.entries.filter(
                    (searchEntry) => searchEntry.accountIdHex != existingEntry.accountIdHex
                );
                this.entries.push(existingEntry);
            } else if (account.parent_account_id == account.id) {
                const parentAccount = data.accounts.find(
                    (searchAccount: Account) => searchAccount.id == account.parent_account_id
                );
                if (!parentAccount) {
                    continue;
                }
                let parentEntry = this.entries.find(
                    (searchEntry) => searchEntry.accountIdHex == account.parent_account_id
                );
                if (parentEntry) {
                    parentEntry.total += entry.total;
                    parentEntry.subs.push(entry);
                    this.entries = this.entries.filter(
                        (searchEntry) => searchEntry.accountIdHex != account.parent_account_id
                    );
                } else {
                    let parentIdentityStatus: IdentityStatus = IdentityStatus.None;
                    const parentAddress = getSS58Address(
                        account.parent_account_id,
                        this.network.ss58Prefix
                    );
                    let parentDisplay = truncateSS58Address(parentAddress);
                    if (parentAccount.identity) {
                        parentDisplay = parentAccount.identity.display;
                        parentIdentityStatus = parentAccount.identity.confirmed
                            ? IdentityStatus.Confirmed
                            : IdentityStatus.Unconfirmed;
                    }
                    parentEntry = {
                        accountIdHex: account.parent_account_id,
                        address: parentAddress,
                        display: parentDisplay,
                        identityStatus: parentIdentityStatus,
                        total: entry.total,
                        subs: [entry],
                        isExpanded: false,
                    };
                }
                this.entries.push(parentEntry);
            } else if (account.parent_account_id) {
                const parentAccount = data.accounts.find(
                    (searchAccount: Account) => searchAccount.id == account.parent_account_id
                );
                if (!parentAccount) {
                    continue;
                }
                const parentEntry = this.entries.find(
                    (searchEntry) => searchEntry.accountIdHex == account.parent_account_id
                );
                if (parentEntry) {
                    if (parentEntry.subs.length == 0) {
                        parentEntry.subs.push({ ...parentEntry });
                    }
                    parentEntry.total += entry.total;
                    parentEntry.subs.push(entry);
                    this.entries = this.entries.filter(
                        (searchEntry) => searchEntry.accountIdHex != account.parent_account_id
                    );
                    this.entries.push(parentEntry);
                } else {
                    let parentIdentityStatus: IdentityStatus = IdentityStatus.None;
                    const parentAddress = getSS58Address(
                        account.parent_account_id,
                        this.network.ss58Prefix
                    );
                    let parentDisplay = truncateSS58Address(parentAddress);
                    if (parentAccount.identity) {
                        parentDisplay = parentAccount.identity.display;
                        parentIdentityStatus = parentAccount.identity.confirmed
                            ? IdentityStatus.Confirmed
                            : IdentityStatus.Unconfirmed;
                    }
                    const parentEntry: Entry = {
                        accountIdHex: account.parent_account_id,
                        address: parentAddress,
                        display: parentDisplay,
                        identityStatus: parentIdentityStatus,
                        total: entry.total,
                        subs: [entry],
                        isExpanded: false,
                    };
                    this.entries.push(parentEntry);
                }
            } else {
                this.entries.push(entry);
            }
        }
        this.entries.sort((a, b) => Number(b.total - a.total));
        this.displayEntries();
    }

    private displayEntries() {
        this.ui.validatorList.innerHTML = '';
        let html = `<tr><th class="position">#</th><th>ID/ADDRESS</th><th class="reward">TOTAL REWARD (${this.network.ticker})</th></tr>`;
        let position = 1;
        for (const entry of this.entries) {
            if (this.withIdentityOnly && entry.identityStatus == IdentityStatus.None) {
                continue;
            }
            const totalFormatted = formatNumber(entry.total, this.network.decimals, 2);
            let subsHTML = '';
            if (entry.subs.length > 0) {
                if (entry.isExpanded) {
                    subsHTML = '<i class="fa fa-caret-down">&nbsp;</i>';
                } else {
                    subsHTML = '<i class="fa fa-caret-right">&nbsp;</i>';
                }
            }
            let confirmedIconHTML = '';
            switch (entry.identityStatus) {
                case IdentityStatus.Confirmed:
                    confirmedIconHTML = '<img src="/img/icon/id_confirmed_icon.svg">';
                    break;
                case IdentityStatus.Unconfirmed:
                    confirmedIconHTML = '<img src="/img/icon/id_unconfirmed_icon.svg">';
                    break;
            }
            html += `<tr${
                entry.subs.length > 0 ? ' id="' + entry.accountIdHex + '" class="has-sub"' : ''
            }><td class="position">${position}</td><td class="display">${subsHTML}${confirmedIconHTML}${
                entry.display
            }${
                entry.subs.length > 0
                    ? '<span class="sub-count">(' + entry.subs.length + ')</span>'
                    : ''
            }</td><td class="reward">${totalFormatted}</td></tr>`;
            if (entry.subs.length > 0 && entry.isExpanded) {
                for (const subEntry of entry.subs) {
                    const totalFormatted = formatNumber(subEntry.total, this.network.decimals, 2);
                    html += `<tr><td class="position">&nbsp;</td><td class="display"><span class="indentation">&nbsp;|---</span>${subEntry.display}</td><td class="reward">${totalFormatted}</td></tr>`;
                }
            }
            position++;
        }
        this.ui.validatorList.innerHTML = html;
        setTimeout(() => {
            this.entries.forEach((entry, index) => {
                const element = document.getElementById(entry.accountIdHex);
                if (element) {
                    const new_element = element.cloneNode(true);
                    element.parentNode?.replaceChild(new_element, element);
                    new_element.addEventListener('click', async (_event) => {
                        console.log(entry.subs.length);
                        this.entries[index].isExpanded = !this.entries[index].isExpanded;
                        this.displayEntries();
                    });
                }
            });
        }, 500);
    }
}

document.addEventListener('DOMContentLoaded', function (_) {
    new RichValidator().init();
});
