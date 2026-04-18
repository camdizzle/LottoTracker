const BASE = '/api';

async function handle(res) {
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function authJson(password) {
  return {
    'Content-Type': 'application/json',
    'x-admin-password': password,
  };
}

// --- Public ---
export function getTickets() {
  return fetch(`${BASE}/tickets`).then(handle);
}

export function getResults() {
  return fetch(`${BASE}/results`).then(handle);
}

export function getPeople() {
  return fetch(`${BASE}/people`).then(handle);
}

export function getPricing() {
  return fetch(`${BASE}/pricing`).then(handle);
}

export function getTransactions(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetch(`${BASE}/transactions${qs ? `?${qs}` : ''}`).then(handle);
}

// --- Auth ---
export function checkAuth(password) {
  return fetch(`${BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then((r) => r.ok);
}

// --- Admin: tickets ---
export function addTicket(ticket, password) {
  return fetch(`${BASE}/tickets`, {
    method: 'POST',
    headers: authJson(password),
    body: JSON.stringify(ticket),
  }).then(handle);
}

export function deleteTicket(id, password) {
  return fetch(`${BASE}/tickets/${id}`, {
    method: 'DELETE',
    headers: { 'x-admin-password': password },
  }).then(handle);
}

export function refreshResults(password) {
  return fetch(`${BASE}/results/refresh`, {
    method: 'POST',
    headers: { 'x-admin-password': password },
  }).then(handle);
}

export function addManualResult(data, password) {
  return fetch(`${BASE}/results/manual`, {
    method: 'POST',
    headers: authJson(password),
    body: JSON.stringify(data),
  }).then(handle);
}

// --- Admin: people ---
export function addPerson(name, password) {
  return fetch(`${BASE}/people`, {
    method: 'POST',
    headers: authJson(password),
    body: JSON.stringify({ name }),
  }).then(handle);
}

export function updatePerson(id, patch, password) {
  return fetch(`${BASE}/people/${id}`, {
    method: 'PATCH',
    headers: authJson(password),
    body: JSON.stringify(patch),
  }).then(handle);
}

export function deletePerson(id, password) {
  return fetch(`${BASE}/people/${id}`, {
    method: 'DELETE',
    headers: { 'x-admin-password': password },
  }).then(handle);
}

// --- Admin: transactions ---
export function addDeposit({ personId, amountCents, description }, password) {
  return fetch(`${BASE}/transactions/deposit`, {
    method: 'POST',
    headers: authJson(password),
    body: JSON.stringify({ personId, amountCents, description }),
  }).then(handle);
}

export function addPayout({ amountCents, description }, password) {
  return fetch(`${BASE}/transactions/payout`, {
    method: 'POST',
    headers: authJson(password),
    body: JSON.stringify({ amountCents, description }),
  }).then(handle);
}

export function addAdjustment(
  { personId, amountCents, description },
  password
) {
  return fetch(`${BASE}/transactions/adjustment`, {
    method: 'POST',
    headers: authJson(password),
    body: JSON.stringify({ personId, amountCents, description }),
  }).then(handle);
}

export function deleteTransaction(id, password) {
  return fetch(`${BASE}/transactions/${id}`, {
    method: 'DELETE',
    headers: { 'x-admin-password': password },
  }).then(handle);
}
