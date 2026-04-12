const BASE = '/api';

async function handle(res) {
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function getTickets() {
  return fetch(`${BASE}/tickets`).then(handle);
}

export function getResults() {
  return fetch(`${BASE}/results`).then(handle);
}

export function checkAuth(password) {
  return fetch(`${BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then((r) => r.ok);
}

export function addTicket(ticket, password) {
  return fetch(`${BASE}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': password,
    },
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
