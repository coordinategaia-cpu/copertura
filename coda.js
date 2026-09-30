// Coda delle segnalazioni salvata nel telefono (IndexedDB).
// Usata sia dalla pagina sia dal service worker, per inviare anche in background.
(function (g) {
  const DB = 'copertura', STORE = 'segnalazioni';

  function apri() {
    return new Promise((ok, ko) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ko(req.error);
    });
  }

  async function tx(modo, fn) {
    const db = await apri();
    return new Promise((ok, ko) => {
      const t = db.transaction(STORE, modo);
      const risultato = fn(t.objectStore(STORE));
      t.oncomplete = () => ok(risultato && 'result' in risultato ? risultato.result : undefined);
      t.onerror = () => ko(t.error);
    });
  }

  const Coda = {
    aggiungi: (s) => tx('readwrite', (st) => st.put(s)),
    tutte: () => tx('readonly', (st) => st.getAll()),
    async inAttesa() {
      return (await Coda.tutte()).filter((s) => !s.inviata);
    },
    async segnaInviate(ids) {
      const db = await apri();
      await new Promise((ok, ko) => {
        const t = db.transaction(STORE, 'readwrite');
        const st = t.objectStore(STORE);
        ids.forEach((id) => {
          const r = st.get(id);
          r.onsuccess = () => { if (r.result) { r.result.inviata = true; st.put(r.result); } };
        });
        t.oncomplete = ok;
        t.onerror = () => ko(t.error);
      });
    },
    // Invia tutte le segnalazioni in attesa. Restituisce quante ne sono partite.
    async invia() {
      const endpoint = g.CONFIG && g.CONFIG.ENDPOINT;
      if (!endpoint || endpoint.indexOf('http') !== 0) throw new Error('Indirizzo di invio non configurato');
      const lista = await Coda.inAttesa();
      if (!lista.length) return 0;
      // text/plain evita la richiesta preliminare CORS, che Google Apps Script non gestisce
      const risposta = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ segnalazioni: lista.map(({ inviata, ...s }) => s) })
      });
      const esito = await risposta.json();
      if (!esito.ok) throw new Error(esito.errore || 'Errore del foglio');
      await Coda.segnaInviate(esito.ricevuti || []);
      return (esito.ricevuti || []).length;
    }
  };

  g.Coda = Coda;
})(self);
