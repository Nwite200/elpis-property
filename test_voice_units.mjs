import assert from 'node:assert/strict';
import { numberToWords, prepareForSpeech } from './assets/js/digital-human/voice/pronunciation.js';
import { KOKORO_VOICES, kokoroVoiceFor } from './assets/js/digital-human/voice/voice-config.js';
import { detectPidgin, localizeReply, toEnglishIntent } from './assets/js/digital-human/language.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✅ ${name}`); }
  catch (error) { failed++; console.error(`  ❌ ${name}\n     ${error.message}`); }
}

console.log('\n========================================================');
console.log('   Elpis Property — VOICE / LANGUAGE UNIT TESTS');
console.log('========================================================\n');

test('all nine personas have distinct valid Kokoro voices', () => {
  const keys = ['adaora', 'solomon', 'chiamaka', 'emeka', 'amara', 'david', 'ngozi', 'daniel', 'ifeoma'];
  const voices = keys.map(kokoroVoiceFor);
  assert.equal(voices.length, 9);
  assert.equal(new Set(voices).size, 9, 'voices must be unique per persona');
  for (const voice of voices) assert.ok(KOKORO_VOICES[keys[voices.indexOf(voice)]] || voice, 'unknown voice');
});

test('naira amounts become spoken words', () => {
  assert.match(prepareForSpeech('₦12,000,000'), /twelve million naira/i);
  assert.match(prepareForSpeech('₦150,000'), /one hundred and fifty thousand naira/i);
  assert.equal(numberToWords(0), 'zero');
  assert.equal(numberToWords(21), 'twenty-one');
  assert.equal(numberToWords(1000000), 'one million');
});

test('Nigerian names and places use approved pronunciation', () => {
  assert.match(prepareForSpeech('Abuja and Ibeju-Lekki'), /ah-boo-jah/i);
  assert.match(prepareForSpeech('Ibeju-Lekki'), /ee-beh-joo lekki/i);
  assert.match(prepareForSpeech('Chiamaka and Ngozi'), /chee-ah-mah-kah/i);
  assert.match(prepareForSpeech('Chiamaka and Ngozi'), /n-goh-zee/i);
  assert.match(prepareForSpeech('ELPIS ACCESS'), /Elpis Access/i);
});

test('representative Pidgin expressions are detected', () => {
  const samples = [
    'Abeg, I need house for Lekki.',
    'How much e be?',
    'I wan buy property.',
    'I dey find two bedroom.',
    'Show me wetin una get.',
    'I don pay.',
    'My payment never reflect.',
    'I no understand.',
    'Make you explain am again.',
    'I wan talk to human being.',
    'No wahala.',
    'How I go take register?'
  ];
  for (const sample of samples) assert.equal(detectPidgin(sample), true, `not detected: ${sample}`);
  assert.equal(detectPidgin('I would like to inspect a three bedroom duplex in Abuja.'), false);
});

test('Pidgin requests map to the correct English intent', () => {
  assert.match(toEnglishIntent('Abeg, I need house for Lekki'), /please,? i need house for lekki/i);
  assert.match(toEnglishIntent('How much e be'), /price of the property/i);
  assert.match(toEnglishIntent('I wan talk to human being'), /talk to a human/i);
  assert.match(toEnglishIntent('How I go take register'), /how do i register/i);
  assert.match(toEnglishIntent('My payment never reflect'), /payment has not reflected/i);
});

test('Pidgin replies keep real data but lead in Pidgin', () => {
  const reply = localizeReply({ text: 'I found 2 available properties.', actions: [] }, 'pidgin', 'property');
  assert.match(reply.text, /No wahala/i);
  assert.match(reply.text, /I found 2 available properties/);
  const human = localizeReply({ text: 'Choose a staff member.', actions: [] }, 'pidgin', 'human');
  assert.match(human.text, /I go find person/i);
  const english = localizeReply({ text: 'English reply', actions: [] }, 'english', 'human');
  assert.equal(english.text, 'English reply');
});

console.log(`\n   RESULT: ${passed} PASSED | ${failed} FAILED\n`);
process.exit(failed ? 1 : 0);
