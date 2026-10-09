// Headless test: runs dist/index.html against mocked phoenix-1 REST responses (test values, not chain data).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const out = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });
const list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'restricted.json'), 'utf8'));

const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function enc(hrp, bytes) {
  let acc = 0, bits = 0; const d = [];
  for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; d.push((acc >> bits) & 31); } }
  if (bits) d.push((acc << (5 - bits)) & 31);
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  const pm = v => { let c = 1; for (const x of v) { const t = c >>> 25; c = ((c & 0x1ffffff) << 5) ^ x; for (let i = 0; i < 5; i++) if ((t >>> i) & 1) c ^= GEN[i]; } return c; };
  const ex = [...hrp].map(c => c.charCodeAt(0) >> 5).concat([0], [...hrp].map(c => c.charCodeAt(0) & 31));
  const p = pm(ex.concat(d, [0, 0, 0, 0, 0, 0])) ^ 1;
  const chk = [0, 1, 2, 3, 4, 5].map(i => (p >> (5 * (5 - i))) & 31);
  return hrp + '1' + d.concat(chk).map(i => B32[i]).join('');
}
const wallet = n => enc('terra', Array.from({ length: 20 }, (_, i) => (n * 37 + i * 11) & 255));
const valop = n => enc('terravaloper', Array.from({ length: 20 }, (_, i) => (n * 53 + i * 7) & 255));
const contract = n => enc('terra', Array.from({ length: 32 }, (_, i) => (n * 29 + i * 5) & 255));

const now = Date.now(), day = 86400000, iso = t => new Date(t).toISOString();
const vals = Array.from({ length: 12 }, (_, i) => ({ operator_address: valop(i + 1), status: 'BOND_STATUS_BONDED', jailed: false, tokens: String(Math.round(40e12 / (i + 1))), description: { moniker: i === 3 ? '<img src=x onerror=alert(1)> Evil & Co' : 'Validator ' + (i + 1) }, consensus_pubkey: { '@type': '/cosmos.crypto.ed25519.PubKey', key: 'x' } }));
vals.push({ operator_address: valop(99), status: 'BOND_STATUS_UNBONDED', jailed: true, tokens: '5', description: { moniker: 'Gone' }, consensus_pubkey: { '@type': '/cosmos.crypto.ed25519.PubKey' } });
const ME = wallet(7), GRANTEE = wallet(8), SPENDER = contract(3), TOKEN = contract(4), ADMIN = wallet(9), NEVER = wallet(11);
const unb = {
  [valop(1)]: [{ delegator_address: list.v[0], entries: [{ completion_time: iso(now + 0.5 * day), balance: '3000000000000' }, { completion_time: iso(now + 9 * day), balance: '1200000000000' }] }, { delegator_address: wallet(20), entries: [{ completion_time: iso(now + 3.2 * day), balance: '800000000000' }] }],
  [valop(2)]: [{ delegator_address: list.a[0], entries: [{ completion_time: iso(now + 2.1 * day), balance: '500000000000' }] }, { delegator_address: ME, entries: [{ completion_time: iso(now + 20.5 * day), balance: '42000000' }] }],
  [valop(3)]: [{ delegator_address: wallet(21), entries: [{ completion_time: iso(now + 14.3 * day), balance: '2400000000000' }, { completion_time: iso(now + 15.3 * day), balance: '300000000000' }] }],
};
const J = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
const hits = {};
function handle(url) {
  const u = new URL(url), p = u.pathname, q = u.searchParams; let m;
  hits[p.replace(/terra(valoper)?1[0-9a-z]+/g, ':a')] = 1;
  if (p.endsWith('/blocks/latest')) return J({ block: { header: { height: '23201442', time: iso(now - 4000), chain_id: 'phoenix-1' } } });
  if (p.endsWith('/node_info')) return J({ default_node_info: { version: '0.38.21', network: 'phoenix-1' }, application_version: { name: 'terra', version: '2.22.0', cosmos_sdk_version: 'v0.50.15-terra.0' } });
  if (p.endsWith('/staking/v1beta1/pool')) return J({ pool: { bonded_tokens: '310000000000000', not_bonded_tokens: '9000000000000' } });
  if (p.endsWith('/supply/by_denom')) return J({ amount: { denom: 'uluna', amount: '1180000000000000' } });
  if (p.endsWith('/current_plan')) return J({ plan: null });
  if (p.endsWith('/consensus/v1/params')) return J({ params: { validator: { pub_key_types: ['ed25519'] } } });
  if (p.endsWith('/gov/v1/proposals')) return q.get('proposal_status') === '2'
    ? J({ proposals: [{ id: '4853', title: 'TEST Proposal <b>alpha</b>', status: 'PROPOSAL_STATUS_VOTING_PERIOD', voting_end_time: iso(now + 1.5 * day), expedited: true }] })
    : J({ proposals: [{ id: '4853', title: 'TEST Proposal <b>alpha</b>', status: 'PROPOSAL_STATUS_VOTING_PERIOD', voting_end_time: iso(now + 1.5 * day), expedited: true }, { id: '4852', title: 'TEST Proposal beta', status: 'PROPOSAL_STATUS_PASSED', voting_end_time: iso(now - 3 * day) }, { id: '4851', title: 'TEST Proposal gamma', status: 'PROPOSAL_STATUS_REJECTED', voting_end_time: iso(now - 30 * day) }] });
  if (p.endsWith('/staking/v1beta1/validators')) return J({ validators: vals, pagination: { next_key: null } });
  if ((m = p.match(/validators\/(terravaloper1[0-9a-z]+)\/unbonding_delegations$/))) return m[1] === valop(5) ? { status: 500, body: 'boom' } : J({ unbonding_responses: (unb[m[1]] || []).map(x => ({ ...x, validator_address: m[1] })), pagination: { next_key: null } });
  if ((m = p.match(/balances\/(terra1[0-9a-z]+)\/by_denom$/))) return J({ balance: { denom: 'uluna', amount: m[1] === list.a[0] ? '77000000000' : m[1] === ME ? '1234560000' : '1000000' } });
  if ((m = p.match(/staking\/v1beta1\/delegations\/(terra1[0-9a-z]+)$/))) return J({ delegation_responses: m[1] === ME ? [{ delegation: { validator_address: valop(1) }, balance: { denom: 'uluna', amount: '5000000000' } }] : [] });
  if ((m = p.match(/delegators\/(terra1[0-9a-z]+)\/unbonding_delegations$/))) return J({ unbonding_responses: m[1] === ME ? [{ validator_address: valop(2), entries: [{ completion_time: iso(now + 20.5 * day), balance: '42000000' }] }] : [] });
  if ((m = p.match(/auth\/v1beta1\/accounts\/(terra1[0-9a-z]+)$/))) {
    if (m[1] === NEVER) return { status: 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ code: 5, message: 'account not found' }) };
    return J({ account: { '@type': '/cosmos.auth.v1beta1.BaseAccount', address: m[1], pub_key: m[1] === TOKEN ? null : { '@type': '/cosmos.crypto.secp256k1.PubKey', key: 'A' }, account_number: '10', sequence: '321' } });
  }
  if ((m = p.match(/bank\/v1beta1\/balances\/(terra1[0-9a-z]+)$/))) return J({ balances: [{ denom: 'uluna', amount: '1234560000' }, { denom: 'ibc/ABC', amount: '5' }] });
  if (p.includes('/authz/v1beta1/grants/granter/')) return J({ grants: p.endsWith(ME) ? [
    { granter: ME, grantee: GRANTEE, authorization: { '@type': '/cosmos.authz.v1beta1.GenericAuthorization', msg: '/cosmos.bank.v1beta1.MsgSend' }, expiration: null },
    { granter: ME, grantee: GRANTEE, authorization: { '@type': '/cosmos.staking.v1beta1.StakeAuthorization', max_tokens: null, authorization_type: 'AUTHORIZATION_TYPE_DELEGATE' }, expiration: iso(now + 90 * day) },
    { granter: ME, grantee: wallet(12), authorization: { '@type': '/cosmos.authz.v1beta1.GenericAuthorization', msg: '/cosmos.staking.v1beta1.MsgUndelegate' }, expiration: iso(now - 5 * day) }] : [] });
  if (p.includes('/feegrant/v1beta1/issued/')) return J({ allowances: p.endsWith(ME) ? [{ granter: ME, grantee: GRANTEE, allowance: { '@type': '/cosmos.feegrant.v1beta1.BasicAllowance', spend_limit: [], expiration: null } }] : [] });
  if ((m = p.match(/wasm\/v1\/contract\/(terra1[0-9a-z]+)$/))) return J({ address: m[1], contract_info: { code_id: '12', creator: ADMIN, admin: ADMIN, label: 'test token' } });
  if ((m = p.match(/wasm\/v1\/contract\/(terra1[0-9a-z]+)\/smart\//))) return m[1] === TOKEN ? J({ data: { allowances: [{ spender: SPENDER, allowance: '340282366920938463463374607431768211455', expires: { never: {} } }] } }) : { status: 500, body: 'not a cw20' };
  if (u.host === 'raw.githubusercontent.com' && p.endsWith('assetlist.json')) return J({ chain_name: 'terra2', assets: [{ type_asset: 'cw20', address: TOKEN, symbol: 'TST', denom_units: [{ denom: 'x', exponent: 0 }, { denom: 'tst', exponent: 6 }] }, { type_asset: 'sdk.coin', base: 'uluna', symbol: 'LUNA' }] });
  return { status: 404, body: 'nope' };
}

(async () => {
  const browser = await chromium.launch();
  const file = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
  const fails = [];
  const check = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : '')); if (!cond) fails.push(name); };

  async function open(opts) {
    const ctx = await browser.newContext({ viewport: opts.viewport, colorScheme: opts.scheme, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e))); page.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
    await page.route(u => !u.href.startsWith('file:'), async route => {
      const url = route.request().url();
      if (!opts.live || url.includes('fonts.g')) return route.abort();
      if (!url.includes('publicnode') && !url.includes('raw.githubusercontent')) return route.abort();
      return route.fulfill(handle(url));
    });
    await page.goto(file + (opts.hash || ''));
    return { page, errs, ctx };
  }
  const txt = (page, sel) => page.locator(sel).innerText();
  const noHScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  // ---- live (mocked), desktop dark
  {
    const { page, errs } = await open({ live: true, viewport: { width: 1280, height: 900 }, scheme: 'dark' });
    await page.waitForFunction(() => document.querySelector('#q-top tbody tr') && /liquid/.test(document.querySelector('#tally-sum').textContent), null, { timeout: 20000 });
    check('conn shows live', /Live via publicnode · block 23,201,442/.test(await txt(page, '#conn-text')));
    check('version readout', (await txt(page, '#r-ver')) === '2.22.0' && /includes/.test(await txt(page, '#r-ver-s')));
    check('staked readout', (await txt(page, '#r-bond')) === '310M' && /26.3% of all LUNA/.test(await txt(page, '#r-bond-s')), await txt(page, '#r-bond-s'));
    const unbT = 3000000 + 1200000 + 800000 + 500000 + 42 + 2400000 + 300000;
    check('unbonding total = sum of mocked entries', (await txt(page, '#r-unb')) === '8.2M' && (await txt(page, '#r-unb-s')).startsWith('7 exits'), await txt(page, '#r-unb') + ' / ' + await txt(page, '#r-unb-s') + ' expect ' + unbT);
    check('restricted readout 471', (await txt(page, '#r-list')) === '471' && /450 affected, 21 attacker/.test(await txt(page, '#r-list-s')));
    check('votes open', (await txt(page, '#r-gov')) === '1');
    const alerts = await txt(page, '#alerts');
    check('alert: restricted unbonding 4.7M, 3.5M within 7d', /4\.7M LUNA is unbonding from restricted wallets/.test(alerts) && /3\.5M of it unlocks within 7 days/.test(alerts), alerts.replace(/\n/g, ' | ').slice(0, 400));
    check('alert: expedited proposal, title escaped', /Proposal 4853 is in voting: TEST Proposal <b>alpha<\/b>/.test(alerts));
    check('alert: big exits from other wallets (3)', /3 exits above 250K LUNA/.test(alerts));
    check('alert: incomplete queue (1 validator failed)', /1 validator could not be read/.test(alerts));
    check('alert: top validators', /The top 2 validators hold more than a third/.test(alerts));
    check('alert: attacker liquid', /77\.02K liquid LUNA sits in attacker-associated/.test(alerts));
    check('chart has bars', (await page.locator('#q-chart svg path').count()) >= 5, String(await page.locator('#q-chart svg path').count()));
    check('daily table has 21 rows', (await page.locator('#q-table tbody tr').count()) === 21);
    const top = await txt(page, '#q-top');
    check('top exits sorted, flagged', top.indexOf('3,000,000') < top.indexOf('2,400,000') && /Affected, restricted/.test(top) && /Attacker-associated/.test(top));
    check('moniker with markup rendered as text', (await page.locator('#val-bars img').count()) === 0 && /<img src=x/.test(await txt(page, '#val-bars')));
    check('validator bars 10', (await page.locator('#val-bars .bar-row').count()) === 10);
    check('gov table 3 rows', (await page.locator('#gov-table tbody tr').count()) === 3);
    check('list: attacker first with tally', /Attacker-associated/.test(await page.locator('#list-table tbody tr').first().innerText()) && /77,000/.test(await txt(page, '#list-table')));
    await page.hover('#q-chart svg rect[tabindex]');
    check('tooltip shows', await page.locator('#q-chart .tip').isVisible() && /Restricted wallets: 3,000,000/.test(await txt(page, '#q-chart .tip')), await txt(page, '#q-chart .tip'));
    await page.screenshot({ path: path.join(out, '1-watch-dark.png'), fullPage: true });

    // watchlist
    await page.fill('#watch-in', 'abandon ability able about above absent absorb abstract absurd abuse access accident');
    await page.click('#watch-add');
    check('watchlist refuses a seed phrase', /recovery phrase/.test(await txt(page, '#watch-msg')));
    await page.fill('#watch-in', ME); await page.click('#watch-add');
    await page.waitForFunction(() => /Unbonding/.test(document.querySelector('#watch-table tbody')?.innerText || ''));
    check('watchlist row values', /1,234.56/.test(await txt(page, '#watch-table')) && /5,000/.test(await txt(page, '#watch-table')) && /\b42\b/.test(await txt(page, '#watch-table')));
    check('alert: watchlist unbonding', /A watchlist address is unbonding 42 LUNA/.test(await txt(page, '#alerts')));

    // checkup with grants
    await page.click('#tab-checkup'); await page.fill('#ck-in', ME); await page.click('#ck-run');
    await page.waitForFunction(() => /Action needed/.test(document.querySelector('#ck-out h2')?.innerText || ''), null, { timeout: 15000 });
    const ck = await txt(page, '#ck-out');
    check('checkup: not on list', /Not on the restricted list/.test(ck));
    check('checkup: crit authz MsgSend + revoke cmd', /can send your coins anywhere/.test(ck) && ck.includes('terrad tx authz revoke ' + GRANTEE + ' /cosmos.bank.v1beta1.MsgSend --from ' + ME + ' --chain-id phoenix-1'));
    check('checkup: stake auth mapped to MsgDelegate, expired grant marked', ck.includes('/cosmos.staking.v1beta1.MsgDelegate') && /Expired/.test(ck));
    check('checkup: unlimited feegrant', /can pay fees from this wallet, with no limit/.test(ck) && ck.includes('terrad tx feegrant revoke ' + ME + ' ' + GRANTEE));
    check('checkup: cw20 unlimited allowance', /effectively unlimited amount of TST/.test(ck) && ck.includes('decrease_allowance'));
    check('checkup: holdings', /Liquid LUNA\s+1,234.56/.test(ck) && /Staked LUNA\s+5,000 across 1 validator/.test(ck) && /Unbonding LUNA\s+42/.test(ck), (ck.match(/Holdings[\s\S]{0,200}/) || [''])[0].replace(/\n/g, ' | '));
    check('checkup: pubkey note', /Public key is on-chain \(secp256k1\)/.test(ck));
    await page.locator('input[name=origin][value=desktop]').check();
    check('origin advice', /newly generated recovery phrase/.test(await txt(page, '#ck-out .note')));
    // contract + never-seen
    await page.fill('#ck-in', TOKEN); await page.click('#ck-run');
    await page.waitForFunction(() => /Smart contract/.test(document.querySelector('#ck-out')?.innerText || '') && !/Reading the chain/.test(document.querySelector('#ck-out h2').innerText));
    check('checkup: contract admin', /This contract can be upgraded by its admin/.test(await txt(page, '#ck-out')));
    await page.fill('#ck-in', NEVER); await page.click('#ck-run');
    await page.waitForFunction(() => /No account on phoenix-1 yet/.test(document.querySelector('#ck-out')?.innerText || ''));
    check('checkup: unknown account handled', true);
    await page.fill('#ck-in', ME.slice(0, -1) + (ME.endsWith('q') ? 'p' : 'q')); await page.click('#ck-run');
    check('checkup: bad checksum rejected', /not a valid address/.test(await txt(page, '#ck-msg')));
    await page.fill('#ck-in', valop(1)); await page.click('#ck-run');
    check('checkup: valoper rejected', /validator operator address/.test(await txt(page, '#ck-msg')));

    // quantum
    await page.click('#tab-quantum');
    const lad = await txt(page, '#ladder');
    check('ladder: live versions', /CometBFT 0\.38\.21/.test(lad) && /Cosmos SDK 0\.50\.15/.test(lad) && /Key types allowed today: ed25519/.test(lad) && /Currently 0\.0% of voting power/.test(lad), lad.replace(/\n/g, ' | ').slice(0, 300));
    check('ladder: 4 not-yet + not measured', (lad.match(/Not yet/g) || []).length === 4 && /Not measured/.test(lad));
    check('qubit chart drawn', (await page.locator('#qubits circle').count()) === 3);
    await page.fill('#qx-in', ME); await page.click('#qx-run');
    await page.waitForFunction(() => /Key is public/.test(document.querySelector('#qx-out').innerText));
    await page.fill('#qx-in', NEVER); await page.click('#qx-run');
    await page.waitForFunction(() => /Key not published/.test(document.querySelector('#qx-out').innerText));
    check('exposure check both ways', true);
    await page.screenshot({ path: path.join(out, '3-quantum-dark.png'), fullPage: true });
    check('no page errors (live)', errs.length === 0, errs.join(' ; '));
    console.log('endpoints hit:', Object.keys(hits).sort().join('\n  '));
  }

  // ---- live (mocked), phone light: checkup result
  {
    const { page, errs } = await open({ live: true, viewport: { width: 390, height: 844 }, scheme: 'light', hash: '#checkup' });
    check('hash opens checkup tab', await page.locator('#wing-checkup').isVisible() && !(await page.locator('#wing-watch').isVisible()));
    await page.fill('#ck-in', ME); await page.click('#ck-run');
    await page.waitForFunction(() => /Action needed/.test(document.querySelector('#ck-out h2')?.innerText || ''), null, { timeout: 15000 });
    check('phone: checkup no horizontal scroll', await noHScroll(page));
    await page.screenshot({ path: path.join(out, '2-checkup-phone-light.png'), fullPage: true });
    await page.click('#tab-watch'); await page.waitForFunction(() => document.querySelector('#q-top tbody tr'));
    check('phone: watch no horizontal scroll', await noHScroll(page));
    await page.screenshot({ path: path.join(out, '4-watch-phone-light.png'), fullPage: true });
    await page.click('#tab-quantum');
    check('phone: quantum no horizontal scroll', await noHScroll(page));
    const over = await page.evaluate(() => [...document.querySelectorAll('#qubits text')].filter(t => { const b = t.getBBox(), w = t.ownerSVGElement.viewBox.baseVal.width; return b.x < 0 || b.x + b.width > w; }).length);
    check('phone: qubit labels inside plot', over === 0, String(over));
    await page.screenshot({ path: path.join(out, '5-quantum-phone-light.png'), fullPage: true });
    check('no page errors (phone)', errs.length === 0, errs.join(' ; '));
  }

  // ---- offline (what the preview sees)
  {
    const { page, errs } = await open({ live: false, viewport: { width: 1280, height: 900 }, scheme: 'light' });
    await page.waitForSelector('#offline:not([hidden])');
    check('offline: banner + conn', /No live connection/.test(await txt(page, '#conn-text')));
    check('offline: list still renders', (await page.locator('#list-table tbody tr').count()) === 30 && (await txt(page, '#r-list')) === '471');
    await page.fill('#list-q', list.v[5].slice(6, 20));
    check('offline: list search finds one', (await page.locator('#list-table tbody tr').count()) === 1);
    await page.click('#tab-checkup'); await page.click('#ck-sample');
    await page.waitForSelector('#ck-out:not([hidden])');
    const ck = await txt(page, '#ck-out');
    check('offline: sample flagged restricted', /Action needed/.test(ck) && /On the restricted list as an affected wallet/.test(ck) && /Chain checks did not run/.test(ck));
    await page.click('#tab-quantum');
    const lad = await txt(page, '#ladder');
    check('offline: ladder from static versions', /CometBFT 0\.38\.21/.test(lad) && /Currently 0\.0%/.test(lad) && (lad.match(/Not yet/g) || []).length === 4);
    await page.click('#tab-watch');
    await page.screenshot({ path: path.join(out, '6-watch-offline-light.png'), fullPage: true });
    check('no page errors (offline)', errs.length === 0, errs.join(' ; '));
  }
  await browser.close();
  console.log(fails.length ? '\n' + fails.length + ' FAILED: ' + fails.join(', ') : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
