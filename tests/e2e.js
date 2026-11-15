const assert = require('assert');

async function main() {
  const base = 'http://localhost:8080/api/v1';

  console.log('1. Testing Admin Login...');
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'ChangeMe123!Strong' })
  });
  assert.strictEqual(loginRes.status, 200, 'Login failed');
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  assert.ok(token, 'Access token missing');
  console.log('   Admin logged in successfully! User:', loginData.user.fullName, 'Role:', loginData.user.role);

  console.log('2. Testing /auth/me...');
  const meRes = await fetch(`${base}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(meRes.status, 200);
  const meData = await meRes.json();
  assert.strictEqual(meData.user.email, 'admin@example.com');
  console.log('   /auth/me confirmed!');

  console.log('3. Testing Dashboard...');
  const dashRes = await fetch(`${base}/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(dashRes.status, 200);
  const dashData = await dashRes.json();
  console.log('   Dashboard KPI counts:', JSON.stringify(dashData.counts));

  console.log('4. Testing Create Design...');
  const createDesignRes = await fetch(`${base}/designs`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Twill 2/2 Test Design',
      description: 'Initial test weave',
      warpEnds: 8,
      weftPicks: 8,
      weaveData: [
        [1,1,0,0,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,0,0,1,1],
        [1,0,0,1,1,0,0,1],
        [1,1,0,0,1,1,0,0],
        [0,1,1,0,0,1,1,0],
        [0,0,1,1,0,0,1,1],
        [1,0,0,1,1,0,0,1]
      ],
      cellColors: Array(8).fill(null).map(() => Array(8).fill(null)),
      warpColors: ['#23364C','#23364C','#23364C','#23364C','#D92D20','#D92D20','#D92D20','#D92D20'],
      weftColors: ['#FFFFFF','#FFFFFF','#FFFFFF','#FFFFFF','#E4E4E1','#E4E4E1','#E4E4E1','#E4E4E1'],
      settings: {},
      thumbnail: ''
    })
  });
  const designBody = await createDesignRes.json();
  assert.strictEqual(createDesignRes.status, 201, `Create design failed: ${JSON.stringify(designBody)}`);
  const designId = designBody.id;
  console.log('   Created design ID:', designId, 'Name:', designBody.name);

  console.log('5. Testing Calculations API...');
  const calcRes = await fetch(`${base}/calc/consumption`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: 'ne',
      warpCount: 30,
      weftCount: 30,
      warpDensity: 24,
      weftDensity: 20,
      warpCrimp: 8,
      weftCrimp: 6,
      warpPrice: 150,
      weftPrice: 140,
      fabricWidthCm: 150,
      selvedgeEnds: 40,
      weavingCost: 5,
      finishingCost: 3,
      profitMargin: 20
    })
  });
  assert.strictEqual(calcRes.status, 200, 'Calc failed');
  const calcData = await calcRes.json();
  console.log('   Calculated total warp ends:', calcData.totalWarpEnds, 'Cover:', calcData.coverStatus);

  console.log('6. Testing Design Share Link...');
  const shareRes = await fetch(`${base}/designs/${designId}/share`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.ok(shareRes.status === 200 || shareRes.status === 201, `Share failed: ${shareRes.status}`);
  const shareData = await shareRes.json();
  const shareToken = shareData.url.split('/share/')[1];
  console.log('   Generated Share URL:', shareData.url, 'Token:', shareToken);

  console.log('7. Testing Public Design by Share Token...');
  const publicRes = await fetch(`${base}/public/designs/${shareToken}`);
  assert.strictEqual(publicRes.status, 200);
  const publicData = await publicRes.json();
  console.log('   Public view retrieved design title:', publicData.name);

  console.log('8. Testing WIF Export...');
  const wifRes = await fetch(`${base}/designs/${designId}/export/wif`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(wifRes.status, 200);
  const wifText = await wifRes.text();
  assert.ok(wifText.includes('[WEAVING]'));
  console.log('   WIF export contains valid header! Characters:', wifText.length);

  console.log('9. Testing Register New Regular User...');
  const testEmail = `weaver_${Date.now()}@example.com`;
  const regRes = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'StrongUser123!',
      fullName: 'Mahmoud Weaver',
      locale: 'ar'
    })
  });
  assert.strictEqual(regRes.status, 201, 'Registration failed');
  const regData = await regRes.json();
  console.log('   Registered user:', regData.user.email, 'Plan:', regData.user.plan);

  console.log('10. Testing AI Sample Vision Analysis...');
  const zlib = require('zlib');
  const makePng = (w, h) => {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    const makeChunk = (type, data) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
      const t = Buffer.from(type, 'ascii');
      const b = Buffer.concat([t, data]);
      let crc = -1;
      for (let i = 0; i < b.length; i++) { crc ^= b[i]; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320); }
      const crcB = Buffer.alloc(4); crcB.writeUInt32BE((crc ^ -1) >>> 0, 0);
      return Buffer.concat([len, t, data, crcB]);
    };
    const raw = Buffer.alloc(h * (1 + w * 3));
    let pos = 0;
    for (let y = 0; y < h; y++) {
      raw[pos++] = 0;
      for (let x = 0; x < w; x++) {
        const up = ((x + y) % 4) < 2;
        raw[pos++] = up ? 31 : 245; raw[pos++] = up ? 58 : 242; raw[pos++] = up ? 95 : 233;
      }
    }
    return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', zlib.deflateSync(raw)), makeChunk('IEND', Buffer.alloc(0))]);
  };
  const sampleDataUrl = 'data:image/png;base64,' + makePng(32, 32).toString('base64');
  const aiRes = await fetch(`${base}/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ image: sampleDataUrl, warpEnds: 8, weftPicks: 8, locale: 'ar' })
  });
  if (!aiRes.ok) throw new Error('AI sample analyze failed: ' + aiRes.status);
  const aiData = await aiRes.json();
  console.log('   AI Analysis succeeded! Structure:', aiData.structureId, 'Warp:', aiData.warpColor, 'Weft:', aiData.weftColor);

  console.log('\n=== ALL END-TO-END TESTS PASSED WITH 100% SUCCESS! ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
