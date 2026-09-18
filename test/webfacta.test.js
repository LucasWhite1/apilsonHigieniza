import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCpf, toCsv, WebFactaError } from '../src/webfacta.js';

test('normalizeCpf preenche zeros à esquerda', () => {
  assert.equal(normalizeCpf('2855325536'), '02855325536');
  assert.equal(normalizeCpf('5325536'), '00005325536');
});

test('normalizeCpf rejeita entrada vazia ou longa', () => {
  assert.throws(() => normalizeCpf(''), WebFactaError);
  assert.throws(() => normalizeCpf('123456789012'), WebFactaError);
});

test('toCsv escapa aspas e inclui BOM', () => {
  const csv = toCsv([{ cpf: '1', sucesso: true, resposta: 'a"b' }]);
  assert.match(csv, /^\uFEFFCPF;Sucesso;Resposta/);
  assert.match(csv, /"a""b"/);
});
