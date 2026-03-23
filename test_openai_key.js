// test_openai_key.js
// Testa se a OPENAI_API_KEY definida no .env é válida na API da OpenAI

import 'dotenv/config';
import fetch from 'node-fetch';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey || !apiKey.startsWith('sk-')) {
  console.error('OPENAI_API_KEY não encontrada ou inválida.');
  process.exit(1);
}

async function testKey() {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 200) {
      const data = await res.json();
      console.log('✅ OPENAI_API_KEY VÁLIDA! Modelos disponíveis:', data.data.map(m => m.id));
    } else {
      const err = await res.text();
      console.error('❌ OPENAI_API_KEY INVÁLIDA OU SEM PERMISSÃO:', res.status, err);
      process.exit(2);
    }
  } catch (e) {
    console.error('Erro ao testar a chave:', e);
    process.exit(3);
  }
}

testKey();
