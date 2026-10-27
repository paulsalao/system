"use strict";

const STORAGE_KEY = "gcash-wallet-demo-accounts-v1";
const STARTING_BALANCE = 0;

const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const loginPhoneInput = document.querySelector("#login-phone");
const pinInput = document.querySelector("#pin-input");
const loginError = document.querySelector("#login-error");
const signupError = document.querySelector("#signup-error");
const signupUsernameInput = document.querySelector("#signup-username");
const signupPhoneInput = document.querySelector("#signup-phone");
const signupPinInput = document.querySelector("#signup-pin");
const authTitle = document.querySelector("#auth-title");
const authDescription = document.querySelector("#auth-description");
const authKicker = document.querySelector("#auth-kicker");
const authSwitch = document.querySelector("#auth-switch");
const showSignupButton = document.querySelector("#show-signup");
const signoutButton = document.querySelector("#signout-button");
const accountName = document.querySelector("#account-name");
const accountAvatar = document.querySelector("#account-avatar");
const accountChip = document.querySelector("#account-chip");
const accountPhone = document.querySelector("#account-phone");
const balanceAmount = document.querySelector("#balance-amount");
const actionPanel = document.querySelector("#action-panel");
const panelTitle = document.querySelector("#panel-title");
const transactionList = document.querySelector("#transaction-list");
const activityCount = document.querySelector("#activity-count");
const activitySection = document.querySelector("#activity-section");
const showAllTransactionsButton = document.querySelector("#show-all-transactions");
const toast = document.querySelector("#toast");
const balanceVisibility = document.querySelector("#balance-visibility");
const notificationButton = document.querySelector("#notification-button");
const receiptDialog = document.querySelector("#receipt-dialog");
const receiptTitle = document.querySelector("#receipt-title");
const receiptAmount = document.querySelector("#receipt-amount");
const receiptType = document.querySelector("#receipt-type");
const receiptRecipientRow = document.querySelector("#receipt-recipient-row");
const receiptRecipient = document.querySelector("#receipt-recipient");
const receiptDate = document.querySelector("#receipt-date");
const receiptReference = document.querySelector("#receipt-reference");
const receiptBalance = document.querySelector("#receipt-balance");
const receiptAccount = document.querySelector("#receipt-account");

let activeView = "overview";
let toastTimeout;
let balanceVisible = true;
let transactionFilter = "all";
let accounts = loadAccounts();
let account = null;

function loadAccounts() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
		if (Array.isArray(saved)) {
			return saved.filter((wallet) =>
				wallet &&
				typeof wallet.phone === "string" &&
				normalizePhone(wallet.phone) === wallet.phone &&
				typeof wallet.pin === "string" &&
				/^\d{4}$/.test(wallet.pin) &&
				Number.isFinite(wallet.balance) &&
				Array.isArray(wallet.transactions),
			);
		}
		console.warn("Saved demo wallets had an invalid format; starting with an empty wallet list.");
	} catch (error) {
		console.warn("Could not load saved demo wallets.", error);
	}
	return [];
}

function saveAccounts() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
		return true;
	} catch (error) {
		console.warn("Could not save demo wallets in this browser.", error);
		return false;
	}
}

function normalizePhone(value) {
	let digits = value.replace(/\D/g, "");
	if (digits.startsWith("63") && digits.length === 12) digits = `0${digits.slice(2)}`;
	return /^09\d{9}$/.test(digits) ? digits : null;
}

function formatPhone(phone) {
	return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
}

function maskPhone(phone) {
	return `${phone.slice(0, 4)} ••• •${phone.slice(-3)}`;
}

function openWallet(wallet) {
	account = wallet;
	balanceVisible = true;
	const username = wallet.username || "My wallet";
	const initials = username.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "GC";
	accountName.textContent = username;
	accountAvatar.textContent = initials;
	accountChip.setAttribute("aria-label", `${username}, Cash G wallet, ${formatPhone(wallet.phone)}`);
	accountPhone.textContent = `•• ${wallet.phone.slice(-4)}`;
	loginPhoneInput.removeAttribute("aria-invalid");
	pinInput.removeAttribute("aria-invalid");
	signupPhoneInput.removeAttribute("aria-invalid");
	signupPinInput.removeAttribute("aria-invalid");
	loginView.hidden = true;
	dashboardView.hidden = false;
	signoutButton.hidden = false;
	loginError.textContent = "";
	signupError.textContent = "";
	renderBalance();
	renderTransactions();
	renderView("overview");
}

function formatMoney(value) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "PHP",
		minimumFractionDigits: 2,
	}).format(value);
}

function renderBalance() {
	const parts = new Intl.NumberFormat("en-PH", {
		style: "currency",
		currency: "PHP",
		minimumFractionDigits: 2,
	}).formatToParts(account.balance);
	const currency = parts.find((part) => part.type === "currency").value;
	const whole = parts.filter((part) => part.type === "integer" || part.type === "group").map((part) => part.value).join("");
	const decimal = parts.find((part) => part.type === "decimal").value;
	const fraction = parts.find((part) => part.type === "fraction").value;
	balanceAmount.replaceChildren(document.createTextNode(balanceVisible ? `${currency}${whole}` : "••••••"));
	if (balanceVisible) {
		const centsNode = document.createElement("span");
		centsNode.textContent = `${decimal}${fraction}`;
		balanceAmount.append(centsNode);
	}
	balanceAmount.classList.toggle("is-hidden", !balanceVisible);
	balanceVisibility.setAttribute("aria-label", balanceVisible ? "Hide balance" : "Show balance");
	balanceVisibility.setAttribute("aria-pressed", String(!balanceVisible));
}

function createTransactionRow(transaction, index) {
	const row = document.createElement("button");
	row.className = "transaction-row";
	row.type = "button";
	row.dataset.transactionIndex = String(index);
	row.setAttribute("aria-label", `${transaction.description}, ${transaction.amount > 0 ? "plus" : "minus"} ${formatMoney(Math.abs(transaction.amount))}. View receipt.`);

	const icon = document.createElement("span");
	icon.className = `transaction-icon ${transaction.kind}`;
	icon.setAttribute("aria-hidden", "true");
	icon.textContent = transaction.kind === "deposit" ? "＋" : transaction.kind === "withdraw" ? "↙" : transaction.kind === "transfer" ? "⇄" : transaction.kind === "load" ? "▣" : transaction.kind === "bills" ? "▤" : "↗";

	const details = document.createElement("span");
	details.className = "transaction-details";
	const description = document.createElement("strong");
	description.textContent = transaction.description;
	const date = document.createElement("small");
	date.textContent = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(transaction.date));
	details.append(description, date);

	const amount = document.createElement("strong");
	amount.className = `transaction-amount ${transaction.amount > 0 ? "positive" : ""}`;
	amount.textContent = `${transaction.amount > 0 ? "+" : "−"}${formatMoney(Math.abs(transaction.amount))}`;
	row.append(icon, details, amount);
	return row;
}

function renderTransactions() {
	transactionList.replaceChildren();
	activityCount.textContent = `${account.transactions.length} ${account.transactions.length === 1 ? "transaction" : "transactions"}`;

	if (account.transactions.length === 0) {
		const empty = document.createElement("div");
		empty.className = "empty-activity";
		empty.innerHTML = '<span class="empty-icon" aria-hidden="true">✳</span><span><strong>It’s quiet in here.</strong><br />Your wallet transactions will show up here.</span>';
		transactionList.append(empty);
		return;
	}

	account.transactions.slice(0, 8).forEach((transaction, index) => {
		transactionList.append(createTransactionRow(transaction, index));
	});
}

function renderTransactionHistory(filter = transactionFilter) {
	transactionFilter = filter;
	const historyList = actionPanel.querySelector("#history-list");
	const matchingTransactions = account.transactions
		.map((transaction, index) => ({ transaction, index }))
		.filter(({ transaction }) => {
			if (filter === "sent") return transaction.kind === "transfer";
			if (filter === "received") return transaction.kind === "receive";
			if (filter === "withdraw") return transaction.kind === "withdraw";
			if (filter === "other") return ["deposit", "bills", "load", "bank"].includes(transaction.kind);
			return true;
		});

	actionPanel.querySelectorAll("[data-transaction-filter]").forEach((button) => {
		const selected = button.dataset.transactionFilter === filter;
		button.classList.toggle("is-active", selected);
		button.setAttribute("aria-pressed", String(selected));
	});

	historyList.replaceChildren();
	if (matchingTransactions.length === 0) {
		const empty = document.createElement("div");
		empty.className = "empty-activity";
		empty.textContent = account.transactions.length ? "No transactions in this category yet." : "Your wallet transactions will appear here.";
		historyList.append(empty);
		return;
	}

	matchingTransactions.forEach(({ transaction, index }) => {
		historyList.append(createTransactionRow(transaction, index));
	});
}

function showReceipt(transaction, balanceAfter) {
	const transactionLabels = {
		deposit: "Cash in",
		withdraw: "Withdraw",
		transfer: "Send money",
		receive: "Money received",
		bills: "Pay bills",
		load: "Buy load",
		bank: "Bank transfer",
	};
	receiptTitle.textContent = `${transactionLabels[transaction.kind] || "Payment"} complete`;
	receiptAmount.textContent = `${transaction.amount > 0 ? "+" : "−"}${formatMoney(Math.abs(transaction.amount))}`;
	receiptType.textContent = transactionLabels[transaction.kind] || "Account transaction";
	receiptRecipientRow.hidden = !transaction.recipient;
	receiptRecipient.textContent = transaction.recipient || "";
	receiptDate.textContent = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(transaction.date));
	receiptReference.textContent = transaction.reference;
	receiptBalance.textContent = formatMoney(balanceAfter);
	receiptAccount.textContent = `Cash G wallet ···· ${account.phone.slice(-4)}`;
	receiptDialog.showModal();
}

function showTransactionReceipt(index) {
	const transaction = account.transactions[index];
	if (!transaction) return;
	const newerTransactionsTotal = account.transactions
		.slice(0, index)
		.reduce((total, item) => total + item.amount, 0);
	showReceipt(transaction, Number((account.balance - newerTransactionsTotal).toFixed(2)));
}

const views = {
	overview: {
		title: "What would you like to do?",
		content: `<div class="service-grid" aria-label="Wallet services">
			<button class="service-button" type="button" data-action="transfer"><span class="service-icon send-icon" aria-hidden="true">↗</span><strong>Send</strong></button>
			<button class="service-button" type="button" data-action="withdraw"><span class="service-icon withdraw-icon" aria-hidden="true">↙</span><strong>Withdraw</strong></button>
			<button class="service-button" type="button" data-action="bills"><span class="service-icon bills-icon" aria-hidden="true">▤</span><strong>Pay bills</strong></button>
			<button class="service-button" type="button" data-action="load"><span class="service-icon load-icon" aria-hidden="true">▣</span><strong>Buy load</strong></button>
			<button class="service-button" type="button" data-action="bank"><span class="service-icon bank-icon" aria-hidden="true">⇧</span><strong>Bank transfer</strong></button>
			<button class="service-button" type="button" data-action="transactions"><span class="service-icon history-icon" aria-hidden="true">↻</span><strong>Transactions</strong></button>
		</div>`,
	},
	transactions: {
		title: "Transactions",
		content: `<div class="transaction-filters" aria-label="Filter transactions">
			<button class="filter-button is-active" type="button" data-transaction-filter="all" aria-pressed="true">All</button>
			<button class="filter-button" type="button" data-transaction-filter="sent" aria-pressed="false">Sent</button>
			<button class="filter-button" type="button" data-transaction-filter="received" aria-pressed="false">Received</button>
			<button class="filter-button" type="button" data-transaction-filter="withdraw" aria-pressed="false">Withdraw</button>
			<button class="filter-button" type="button" data-transaction-filter="other" aria-pressed="false">Other</button>
		</div><div class="transaction-list history-list" id="history-list"></div>`,
	},
	withdraw: {
		title: "Withdraw",
		content: () => `<form class="operation-form" data-kind="withdraw"><label class="field-label" for="operation-amount">WITHDRAWAL AMOUNT</label><div class="money-input"><span>₱</span><input id="operation-amount" name="amount" type="number" min="1" step="0.01" placeholder="0.00" required /></div><div class="amount-presets" aria-label="Choose a withdrawal amount"><button type="button" data-amount="20">₱20</button><button type="button" data-amount="50">₱50</button><button type="button" data-amount="100">₱100</button><button type="button" data-amount="200">₱200</button></div><p class="available-note">Available balance <strong>${formatMoney(account.balance)}</strong></p><button class="button button-primary operation-submit" type="submit">Withdraw <span aria-hidden="true">→</span></button><p class="operation-message" role="status"></p></form>`,
	},
	transfer: {
		title: "Send money",
		content: () => `<form class="operation-form" data-kind="transfer"><label class="field-label" for="recipient-name">SEND TO MOBILE NUMBER</label><input class="text-input" id="recipient-name" name="recipient" type="tel" inputmode="tel" maxlength="16" placeholder="09XX XXX XXXX" autocomplete="off" required /><p class="field-help">The recipient must have a wallet registered in this browser.</p><label class="field-label amount-label" for="operation-amount">AMOUNT</label><div class="money-input"><span>₱</span><input id="operation-amount" name="amount" type="number" min="1" step="0.01" placeholder="0.00" required /></div><p class="available-note">Available balance <strong>${formatMoney(account.balance)}</strong></p><button class="button button-primary operation-submit" type="submit">Send money <span aria-hidden="true">→</span></button><p class="operation-message" role="status"></p></form>`,
	},
	bills: {
		title: "Pay bills",
		content: () => `<form class="operation-form" data-kind="bills"><label class="field-label" for="bill-name">BILLER</label><select class="text-input" id="bill-name" name="recipient" required><option value="">Choose a biller</option><option>Meralco</option><option>Maynilad</option><option>Globe Telecom</option><option>Manila Water</option></select><label class="field-label amount-label" for="operation-amount">AMOUNT</label><div class="money-input"><span>₱</span><input id="operation-amount" name="amount" type="number" min="1" step="0.01" placeholder="0.00" required /></div><p class="available-note">Available balance <strong>${formatMoney(account.balance)}</strong></p><button class="button button-primary operation-submit" type="submit">Pay bill <span aria-hidden="true">→</span></button><p class="operation-message" role="status"></p></form>`,
	},
	load: {
		title: "Buy mobile load",
		content: () => `<form class="operation-form" data-kind="load"><label class="field-label" for="load-phone">MOBILE NUMBER</label><input class="text-input" id="load-phone" name="recipient" type="tel" inputmode="tel" maxlength="16" placeholder="09XX XXX XXXX" required /><label class="field-label amount-label" for="operation-amount">LOAD AMOUNT</label><div class="money-input"><span>₱</span><input id="operation-amount" name="amount" type="number" min="10" step="1" placeholder="0.00" required /></div><div class="amount-presets" aria-label="Choose a load amount"><button type="button" data-amount="50">₱50</button><button type="button" data-amount="100">₱100</button><button type="button" data-amount="300">₱300</button><button type="button" data-amount="500">₱500</button></div><p class="available-note">Available balance <strong>${formatMoney(account.balance)}</strong></p><button class="button button-primary operation-submit" type="submit">Buy load <span aria-hidden="true">→</span></button><p class="operation-message" role="status"></p></form>`,
	},
	bank: {
		title: "Bank transfer",
		content: () => `<form class="operation-form" data-kind="bank"><label class="field-label" for="bank-name">BANK</label><select class="text-input" id="bank-name" name="recipient" required><option value="">Choose a bank</option><option>BDO</option><option>BPI</option><option>Metrobank</option><option>UnionBank</option></select><label class="field-label amount-label" for="operation-amount">AMOUNT</label><div class="money-input"><span>₱</span><input id="operation-amount" name="amount" type="number" min="1" step="0.01" placeholder="0.00" required /></div><p class="available-note">Available balance <strong>${formatMoney(account.balance)}</strong></p><button class="button button-primary operation-submit" type="submit">Continue <span aria-hidden="true">→</span></button><p class="operation-message" role="status"></p></form>`,
	},
};

function renderView(viewName) {
	activeView = views[viewName] ? viewName : "overview";
	panelTitle.textContent = views[activeView].title;
	activitySection.hidden = activeView === "transactions";
	const content = views[activeView].content;
	actionPanel.innerHTML = typeof content === "function" ? content() : content;
	if (activeView === "transactions") renderTransactionHistory("all");
	if (activeView !== "overview") {
		const backButton = document.createElement("button");
		backButton.className = "back-button";
		backButton.type = "button";
		backButton.dataset.action = "overview";
		backButton.innerHTML = '<span aria-hidden="true">←</span> All services';
		actionPanel.prepend(backButton);
	}

	const form = actionPanel.querySelector(".operation-form");
	if (form) {
		form.addEventListener("submit", handleOperation);
		form.querySelectorAll("[data-amount]").forEach((button) => {
			button.addEventListener("click", () => {
				form.elements.amount.value = button.dataset.amount;
				form.elements.amount.focus();
			});
		});
	}
	actionPanel.querySelectorAll("[data-action]").forEach((button) => {
		button.addEventListener("click", () => renderView(button.dataset.action));
	});
	actionPanel.querySelectorAll("[data-transaction-filter]").forEach((button) => {
		button.addEventListener("click", () => renderTransactionHistory(button.dataset.transactionFilter));
	});
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add("is-visible");
	window.clearTimeout(toastTimeout);
	toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function handleTransactionClick(event) {
	const row = event.target.closest("[data-transaction-index]");
	if (row) showTransactionReceipt(Number(row.dataset.transactionIndex));
}

function handleOperation(event) {
	event.preventDefault();
	const form = event.currentTarget;
	const kind = form.dataset.kind;
	const amount = Number(form.elements.amount.value);
	const message = form.querySelector(".operation-message");

	if (!Number.isFinite(amount) || amount < 1) {
		message.textContent = "Enter an amount of at least ₱1.00.";
		message.className = "operation-message is-error";
		return;
	}
	if (amount > 1_000_000) {
		message.textContent = "For this demo, transactions are limited to ₱1,000,000.";
		message.className = "operation-message is-error";
		return;
	}
	if (kind !== "deposit" && amount > account.balance) {
		message.textContent = "That’s more than your available balance.";
		message.className = "operation-message is-error";
		return;
	}

	let description;
	let signedAmount;
	let recipient;
	let destinationWallet;
	if (kind === "deposit") {
		description = "Cash in";
		signedAmount = amount;
	} else if (kind === "withdraw") {
		description = "Withdraw";
		signedAmount = -amount;
	} else if (kind === "transfer") {
		const recipientPhone = normalizePhone(form.elements.recipient.value);
		if (!recipientPhone) {
			message.textContent = "Enter a valid Philippine mobile number, such as 09171234567.";
			message.className = "operation-message is-error";
			form.elements.recipient.focus();
			return;
		}
		destinationWallet = accounts.find((wallet) => wallet.phone === recipientPhone);
		if (!destinationWallet) {
			message.textContent = "No demo wallet is registered with that number in this browser.";
			message.className = "operation-message is-error";
			form.elements.recipient.focus();
			return;
		}
		if (destinationWallet === account) {
			message.textContent = "Enter a different wallet number to send money.";
			message.className = "operation-message is-error";
			form.elements.recipient.focus();
			return;
		}
		recipient = maskPhone(recipientPhone);
		description = `Sent to ${recipient}`;
		signedAmount = -amount;
	} else {
		recipient = form.elements.recipient.value.trim();
		if (!recipient) {
			form.elements.recipient.focus();
			return;
		}
		const descriptions = {
			transfer: `Sent to ${recipient}`,
			bills: `Bill payment · ${recipient}`,
			load: `Mobile load · ${recipient}`,
			bank: `Bank transfer · ${recipient}`,
		};
		description = descriptions[kind] || `Payment · ${recipient}`;
		signedAmount = -amount;
	}

	const previousSenderBalance = account.balance;
	const previousSenderTransactions = account.transactions;
	const previousRecipientBalance = destinationWallet?.balance;
	const previousRecipientTransactions = destinationWallet?.transactions;
	account.balance = Number((account.balance + signedAmount).toFixed(2));
	const transaction = {
		kind,
		description,
		recipient,
		amount: signedAmount,
		date: new Date().toISOString(),
		reference: `GC-${Date.now().toString().slice(-8)}`,
	};
	account.transactions = [transaction, ...account.transactions].slice(0, 30);
	if (destinationWallet) {
		destinationWallet.balance = Number((destinationWallet.balance + amount).toFixed(2));
		const receivedTransaction = {
			kind: "receive",
			description: `Received from ${maskPhone(account.phone)}`,
			recipient: maskPhone(account.phone),
			amount,
			date: transaction.date,
			reference: transaction.reference,
		};
		destinationWallet.transactions = [receivedTransaction, ...destinationWallet.transactions].slice(0, 30);
	}
	if (!saveAccounts()) {
		account.balance = previousSenderBalance;
		account.transactions = previousSenderTransactions;
		if (destinationWallet) {
			destinationWallet.balance = previousRecipientBalance;
			destinationWallet.transactions = previousRecipientTransactions;
		}
		message.textContent = "Could not save this demo transaction in the browser. Please try again.";
		message.className = "operation-message is-error";
		return;
	}
	renderBalance();
	renderTransactions();
	renderView("overview");
	showReceipt(transaction, account.balance);
}

function setAuthMode(signingUp) {
	loginForm.hidden = signingUp;
	signupForm.hidden = !signingUp;
	authTitle.textContent = signingUp ? "Create your wallet" : "Access your wallet";
	authKicker.textContent = signingUp ? "NEW WALLET" : "WELCOME BACK";
	authDescription.textContent = signingUp
		? "Register a mobile number and create a 4-digit MPIN."
		: "Sign in with your mobile number and MPIN.";
	authSwitch.querySelector("span").textContent = signingUp ? "Already have a wallet?" : "New to Cash G Wallet?";
	showSignupButton.textContent = signingUp ? "Sign in" : "Create an account";
	loginError.textContent = "";
	signupError.textContent = "";
	loginForm.reset();
	signupForm.reset();
	(signingUp ? signupUsernameInput : loginPhoneInput).focus();
}

showSignupButton.addEventListener("click", () => setAuthMode(signupForm.hidden));

loginForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const phone = normalizePhone(loginPhoneInput.value);
	if (!phone) {
		loginError.textContent = "Enter a valid Philippine mobile number, such as 09171234567.";
		loginPhoneInput.setAttribute("aria-invalid", "true");
		loginPhoneInput.focus();
		return;
	}
	const savedWallet = accounts.find((wallet) => wallet.phone === phone);
	if (!savedWallet || savedWallet.pin !== pinInput.value) {
		loginError.textContent = "We couldn’t find a wallet with that number and MPIN.";
		pinInput.setAttribute("aria-invalid", "true");
		pinInput.select();
		return;
	}
	loginPhoneInput.removeAttribute("aria-invalid");
	pinInput.removeAttribute("aria-invalid");
	loginForm.reset();
	openWallet(savedWallet);
	panelTitle.focus();
});

signupForm.addEventListener("submit", (event) => {
	event.preventDefault();
	const username = signupUsernameInput.value.trim().replace(/\s+/g, " ");
	if (username.length < 2 || username.length > 24) {
		signupError.textContent = "Enter a username between 2 and 24 characters.";
		signupUsernameInput.setAttribute("aria-invalid", "true");
		signupUsernameInput.focus();
		return;
	}
	const phone = normalizePhone(signupPhoneInput.value);
	if (!phone) {
		signupError.textContent = "Enter a valid Philippine mobile number, such as 09171234567.";
		signupPhoneInput.setAttribute("aria-invalid", "true");
		signupPhoneInput.focus();
		return;
	}
	if (!/^\d{4}$/.test(signupPinInput.value)) {
		signupError.textContent = "Create a 4-digit MPIN using numbers only.";
		signupPinInput.setAttribute("aria-invalid", "true");
		signupPinInput.focus();
		return;
	}
	if (accounts.some((wallet) => wallet.phone === phone)) {
		signupError.textContent = "A Cash G Wallet account already exists with that mobile number. Please sign in instead.";
		signupPhoneInput.setAttribute("aria-invalid", "true");
		signupPhoneInput.focus();
		return;
	}

	const wallet = {
		username,
		phone,
		pin: signupPinInput.value,
		balance: STARTING_BALANCE,
		transactions: [],
	};
	accounts.push(wallet);
	if (!saveAccounts()) {
		accounts.pop();
		signupError.textContent = "Could not save this wallet in the browser. Check browser storage and try again.";
		return;
	}
	signupForm.reset();
	openWallet(wallet);
});

pinInput.addEventListener("input", () => {
	pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
	loginError.textContent = "";
	pinInput.removeAttribute("aria-invalid");
});

signupPinInput.addEventListener("input", () => {
	signupPinInput.value = signupPinInput.value.replace(/\D/g, "").slice(0, 4);
	signupError.textContent = "";
	signupPhoneInput.removeAttribute("aria-invalid");
	signupPinInput.removeAttribute("aria-invalid");
});

signupUsernameInput.addEventListener("input", () => {
	signupError.textContent = "";
	signupUsernameInput.removeAttribute("aria-invalid");
});

loginPhoneInput.addEventListener("input", () => {
	loginError.textContent = "";
	loginPhoneInput.removeAttribute("aria-invalid");
});

signupPhoneInput.addEventListener("input", () => {
	signupError.textContent = "";
	signupPhoneInput.removeAttribute("aria-invalid");
});

signoutButton.addEventListener("click", () => {
	account = null;
	dashboardView.hidden = true;
	loginView.hidden = false;
	signoutButton.hidden = true;
	setAuthMode(false);
});

document.querySelector("#receipt-print").addEventListener("click", () => window.print());
document.querySelector("#receipt-done").addEventListener("click", () => receiptDialog.close());
receiptDialog.addEventListener("close", () => document.querySelector("#panel-title").focus());
showAllTransactionsButton.addEventListener("click", () => renderView("transactions"));
transactionList.addEventListener("click", handleTransactionClick);
actionPanel.addEventListener("click", handleTransactionClick);

balanceVisibility.addEventListener("click", () => {
	balanceVisible = !balanceVisible;
	renderBalance();
});

notificationButton.addEventListener("click", () => {
	notificationButton.classList.add("is-read");
	showToast("You’re all caught up!");
});

dashboardView.addEventListener("click", (event) => {
	const actionButton = event.target.closest("[data-action]");
	if (actionButton && !actionPanel.contains(actionButton)) {
		renderView(actionButton.dataset.action);
	}
});
