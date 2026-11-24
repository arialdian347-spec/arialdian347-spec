import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type {
  GeneratedLetter,
  KopSuratProfile,
  LetterTemplate,
} from './src/types/document.ts';
import {
  getBootstrapData,
  peekNextSequence,
  removeGeneratedLetter,
  removeKopProfile,
  removeTemplate,
  saveBatchLetters,
  saveGeneratedLetter,
  upsertKopProfile,
  upsertTemplate,
} from './server/database.ts';

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/bootstrap', (_req, res) => {
    const data = getBootstrapData();
    res.json(data);
  });

  app.get('/api/sequences/next', (req, res) => {
    const templateId = String(req.query.templateId || '');
    const year = Number(req.query.year) || new Date().getFullYear();
    if (!templateId) {
      res.status(400).json({ error: 'templateId wajib diisi' });
      return;
    }
    const nextSeq = peekNextSequence(templateId, year);
    res.json({ templateId, year, nextSeq });
  });

  app.post('/api/templates', (req, res) => {
    const body = req.body as LetterTemplate;
    if (!body?.id || !body?.name || !body?.code) {
      res.status(400).json({ error: 'Data template tidak lengkap (id, code, name wajib).' });
      return;
    }
    const saved = upsertTemplate(body);
    res.json(saved);
  });

  app.put('/api/templates/:id', (req, res) => {
    const body = req.body as LetterTemplate;
    const saved = upsertTemplate({ ...body, id: req.params.id });
    res.json(saved);
  });

  app.delete('/api/templates/:id', (req, res) => {
    const deleted = removeTemplate(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Template tidak ditemukan' });
      return;
    }
    res.json({ success: true });
  });

  app.post('/api/kop-profiles', (req, res) => {
    const body = req.body as KopSuratProfile;
    if (!body?.id || !body?.organizationName) {
      res.status(400).json({ error: 'Nama instansi wajib diisi.' });
      return;
    }
    const saved = upsertKopProfile(body);
    res.json(saved);
  });

  app.put('/api/kop-profiles/:id', (req, res) => {
    const body = req.body as KopSuratProfile;
    const saved = upsertKopProfile({ ...body, id: req.params.id });
    res.json(saved);
  });

  app.delete('/api/kop-profiles/:id', (req, res) => {
    const deleted = removeKopProfile(req.params.id);
    if (!deleted) {
      res.status(400).json({ error: 'Tidak dapat menghapus profil Kop Surat terakhir.' });
      return;
    }
    res.json({ success: true });
  });

  app.post('/api/letters', (req, res) => {
    const { letter, incrementSequenceYear } = req.body as {
      letter: GeneratedLetter;
      incrementSequenceYear?: number;
    };
    if (!letter?.id || !letter?.letterNumber || !letter?.templateId) {
      res.status(400).json({ error: 'Data surat tidak lengkap.' });
      return;
    }
    const result = saveGeneratedLetter(letter, incrementSequenceYear);
    res.json(result);
  });

  app.post('/api/letters/batch', (req, res) => {
    const { letters, templateId, year } = req.body as {
      letters: GeneratedLetter[];
      templateId: string;
      year: number;
    };
    if (!Array.isArray(letters) || letters.length === 0 || !templateId) {
      res.status(400).json({ error: 'Daftar surat massal tidak boleh kosong.' });
      return;
    }
    const result = saveBatchLetters(letters, templateId, year || new Date().getFullYear());
    res.json(result);
  });

  app.delete('/api/letters/:id', (req, res) => {
    const deleted = removeGeneratedLetter(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Arsip surat tidak ditemukan' });
      return;
    }
    res.json({ success: true });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
