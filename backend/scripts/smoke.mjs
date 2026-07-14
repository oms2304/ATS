#!/usr/bin/env node

const apiUrl = requiredUrl('DEMO_API_URL');
const frontendUrl = requiredUrl('DEMO_FRONTEND_URL');
const email = requiredValue('DEMO_EMAIL');
const password = requiredValue('DEMO_PASSWORD');
const runAi = process.env.RUN_AI_SMOKE === 'true';
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

if (process.env.ALLOW_PRODUCTION_SMOKE !== 'true') {
  throw new Error(
    'Refusing to run without ALLOW_PRODUCTION_SMOKE=true (the test creates temporary records)'
  );
}

let token = '';
let jobId = '';
const documentIds = new Set();
const prepNoteIds = new Set();

function requiredUrl(name) {
  const value = requiredValue(name);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${name} must be an HTTP(S) URL`);
  }
  return value.replace(/\/$/, '');
}

function requiredValue(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function pass(label) {
  console.log(`PASS ${label}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}, expected = [200]) {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(options.timeout || 60_000),
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.arrayBuffer();
  if (!expected.includes(response.status)) {
    const detail =
      body instanceof ArrayBuffer
        ? `${body.byteLength} response bytes`
        : JSON.stringify(body);
    throw new Error(
      `${options.method || 'GET'} ${path} returned ${response.status}: ${detail}`
    );
  }
  return { response, body };
}

async function json(path, method, body, expected = [200]) {
  return request(
    path,
    { method, body: body === undefined ? undefined : JSON.stringify(body) },
    expected
  );
}

async function cleanup() {
  const failures = [];
  const remove = async (label, path, expected) => {
    try {
      await request(path, { method: 'DELETE' }, expected);
    } catch (error) {
      failures.push(
        `${label}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  for (const prepNoteId of prepNoteIds) {
    await remove(
      `prep note ${prepNoteId}`,
      `/api/prep-notes/${prepNoteId}`,
      [204, 404]
    ).catch(() => {});
  }
  if (jobId) {
    await remove(
      `research note for job ${jobId}`,
      `/api/jobs/${jobId}/research-note`,
      [204, 404]
    );
  }
  for (const documentId of documentIds) {
    await remove(
      `document ${documentId}`,
      `/api/documents/${documentId}`,
      [200, 404]
    );
  }
  if (jobId) {
    await remove(`job ${jobId}`, `/api/jobs/${jobId}`, [204, 404]);
  }
  return failures;
}

async function main() {
  console.log(`Smoke target API: ${new URL(apiUrl).host}`);
  console.log(`Smoke target frontend: ${new URL(frontendUrl).host}`);
  console.log(`Node runtime: ${process.version}`);

  const frontend = await fetch(`${frontendUrl}/login`, {
    signal: AbortSignal.timeout(30_000),
  });
  assert(frontend.ok, `Frontend /login returned ${frontend.status}`);
  pass('frontend login page');

  await request('/healthz');
  await request('/readyz');
  const version = await request('/version');
  assert(version.body.version, 'Version endpoint did not return a version');
  pass('API liveness, readiness, and version');

  const login = await json('/api/auth/login', 'POST', { email, password });
  token = login.body?.data?.token;
  assert(token, 'Login response did not contain a token');
  pass('demo login');

  const createdJob = await json(
    '/api/jobs',
    'POST',
    {
      title: `SMOKE-${runId}-Demo Readiness Job`,
      company: 'Codex Smoke Test',
      jobPostingBody:
        'Seeking a candidate who communicates clearly, manages projects, and collaborates across teams.',
      stage: 'Interested',
    },
    [201]
  );
  jobId = createdJob.body?.data?.id;
  assert(jobId, 'Job creation did not return an id');
  await json(`/api/jobs/${jobId}`, 'PATCH', { stage: 'Applied' });
  await json(`/api/jobs/${jobId}`, 'PATCH', { stage: 'Interview' });
  const blocked = await json(
    `/api/jobs/${jobId}`,
    'PATCH',
    { stage: 'Applied' },
    [422]
  );
  assert(
    blocked.body?.details?.requiresConfirmation === true &&
      Array.isArray(blocked.body?.details?.allowed),
    'Blocked transition did not return structured allowed-stage details'
  );
  const persistedJob = await request(`/api/jobs/${jobId}`);
  assert(
    persistedJob.body?.data?.stage === 'Interview',
    'Blocked backward stage transition changed persisted state'
  );
  pass('job creation and non-forward transition guard');

  const pdf = new Blob(
    [
      '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
    ],
    { type: 'application/pdf' }
  );
  const uploadForm = new FormData();
  uploadForm.set('file', pdf, 'demo-readiness.pdf');
  uploadForm.set('type', 'resume');
  uploadForm.set('title', 'Demo Readiness Resume');
  const uploaded = await request(
    '/api/documents/upload',
    { method: 'POST', body: uploadForm },
    [201]
  );
  const documentId = uploaded.body?.data?.id;
  const versionId = uploaded.body?.data?.version?.id;
  assert(documentId && versionId, 'Upload did not return document/version ids');
  documentIds.add(documentId);

  const rejectedForm = new FormData();
  rejectedForm.set(
    'file',
    new Blob(['not an image'], { type: 'image/png' }),
    'bad.png'
  );
  rejectedForm.set('type', 'resume');
  rejectedForm.set('title', 'Rejected Upload');
  await request(
    '/api/documents/upload',
    { method: 'POST', body: rejectedForm },
    [400]
  ).then(({ body }) =>
    assert(body?.fields?.file?.length > 0, 'PNG rejection lacked fields.file')
  );
  pass('PDF upload and unsupported-format rejection');

  const updated = await json(`/api/documents/${documentId}`, 'PATCH', {
    title: 'Demo Readiness Resume Updated',
    status: 'active',
    tags: [' demo ', 'Demo', 'brandco'],
  });
  assert(
    JSON.stringify(updated.body?.data?.tags) ===
      JSON.stringify(['demo', 'brandco']),
    'Tag normalization/deduplication did not persist as expected'
  );
  const activeList = await request('/api/documents?archived=false');
  const activeDocument = activeList.body?.data?.find(
    (document) => document.id === documentId
  );
  assert(
    activeDocument?.hasFile === true,
    'Uploaded file missing from active list'
  );
  assert(
    activeDocument?.fileName === 'demo-readiness.pdf',
    'File metadata missing'
  );

  const versions = await request(`/api/documents/${documentId}/versions`);
  assert(
    versions.body?.data?.[0]?.id === versionId,
    'Version history mismatch'
  );
  assert(
    !Object.hasOwn(versions.body.data[0], 'fileUrl'),
    'Version history exposed a storage URL'
  );

  for (const path of [
    `/api/documents/${documentId}/download`,
    `/api/documents/${documentId}/versions/${versionId}/download`,
  ]) {
    const download = await request(path);
    const downloadedBytes = new Uint8Array(download.body);
    const sourceBytes = new Uint8Array(await pdf.arrayBuffer());
    assert(
      downloadedBytes.length === sourceBytes.length &&
        downloadedBytes.every((byte, index) => byte === sourceBytes[index]),
      `${path} did not return byte-for-byte PDF content`
    );
  }
  pass('metadata, list, history, and authenticated downloads');

  const duplicated = await request(`/api/documents/${documentId}/duplicate`, {
    method: 'POST',
  });
  const duplicateId = duplicated.body?.data?.id;
  assert(
    duplicateId && duplicateId !== documentId,
    'Duplicate id was not independent'
  );
  assert(
    duplicated.body?.data?.versionId !== versionId,
    'Duplicate version id was not independent'
  );
  documentIds.add(duplicateId);
  const duplicateDownload = await request(
    `/api/documents/${duplicateId}/download`
  );
  const duplicateBytes = new Uint8Array(duplicateDownload.body);
  const sourceBytes = new Uint8Array(await pdf.arrayBuffer());
  assert(
    duplicateBytes.length === sourceBytes.length &&
      duplicateBytes.every((byte, index) => byte === sourceBytes[index]),
    'Duplicated PDF bytes did not match the source'
  );

  await request(`/api/documents/${documentId}/archive`, { method: 'PATCH' });
  const afterArchiveActive = await request('/api/documents?archived=false');
  assert(
    !afterArchiveActive.body?.data?.some(
      (document) => document.id === documentId
    ),
    'Archived document remained in the active view'
  );
  const archivedList = await request('/api/documents?archived=true');
  assert(
    archivedList.body?.data?.some((document) => document.id === documentId),
    'Archived document was not returned in archived view'
  );
  await request(`/api/documents/${documentId}/restore`, { method: 'PATCH' });
  const afterRestoreActive = await request('/api/documents?archived=false');
  assert(
    afterRestoreActive.body?.data?.some(
      (document) => document.id === documentId
    ),
    'Restored document did not return to the active view'
  );
  pass('binary duplication, archive, and restore');

  await json(`/api/documents/jobs/${jobId}/link`, 'PUT', {
    documentId,
    type: 'resume',
  });
  await json(
    `/api/documents/jobs/${jobId}/link`,
    'PUT',
    { documentId: duplicateId, type: 'resume' },
    [409]
  );
  await json(`/api/documents/jobs/${jobId}/link`, 'PUT', {
    documentId: duplicateId,
    type: 'resume',
    confirmedReplace: true,
  });
  await request(
    `/api/documents/jobs/${jobId}/link/resume`,
    {
      method: 'DELETE',
    },
    [204]
  );
  pass('document link conflict and confirmed replacement');

  await json(`/api/jobs/${jobId}/research-note`, 'PUT', {
    content: 'Smoke-test company research note.',
  });
  const research = await request(`/api/jobs/${jobId}/research-note`);
  assert(research.body?.data?.content, 'Research note was not persisted');

  const prep = await json(
    `/api/jobs/${jobId}/prep-notes`,
    'POST',
    {
      category: 'questions_to_ask',
      content: 'What defines success in this role?',
    },
    [201]
  );
  const prepNoteId = prep.body?.data?.id;
  assert(prepNoteId, 'Prep-note creation did not return an id');
  prepNoteIds.add(prepNoteId);
  await json(`/api/prep-notes/${prepNoteId}`, 'PATCH', {
    content: 'What would excellent performance look like after 90 days?',
  });
  const prepList = await request(`/api/jobs/${jobId}/prep-notes`);
  assert(
    prepList.body?.data?.some(
      (note) => note.id === prepNoteId && note.content.includes('90 days')
    ),
    'Updated prep note was not persisted'
  );
  const metrics = await request('/api/metrics');
  assert(
    metrics.body?.data &&
      typeof metrics.body.data.totalJobs === 'number' &&
      typeof metrics.body.data.velocity === 'number' &&
      typeof metrics.body.data.stageConversionRate === 'number',
    'Metrics response did not contain the expected numeric shape'
  );
  pass('research notes, prep notes, and metrics');

  if (runAi) {
    const resume = await json('/api/ai/generate-resume', 'POST', { jobId });
    const coverLetter = await json('/api/ai/generate-cover-letter', 'POST', {
      jobId,
    });
    const rewrite = await json('/api/ai/rewrite', 'POST', {
      content: resume.body?.data?.draft,
      instruction: 'Make the summary more concise.',
    });
    const aiResearch = await json(
      `/api/ai/jobs/${jobId}/generate-research`,
      'POST',
      {}
    );
    assert(
      resume.body?.data?.draft &&
        coverLetter.body?.data?.draft &&
        rewrite.body?.data?.draft &&
        aiResearch.body?.data?.draft,
      'One or more AI smoke responses were empty'
    );
    pass('all four AI paths');
  } else {
    console.log('SKIP AI paths (set RUN_AI_SMOKE=true to include them)');
  }

  console.log('SMOKE PASS: all selected demo paths completed successfully');
}

let mainFailed = false;
try {
  await main();
} catch (error) {
  mainFailed = true;
  console.error(
    `SMOKE FAIL: ${error instanceof Error ? error.message : error}`
  );
  process.exitCode = 1;
} finally {
  const cleanupFailures = await cleanup();
  if (cleanupFailures.length > 0) {
    console.error('SMOKE CLEANUP FAIL:');
    for (const failure of cleanupFailures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Cleanup complete for every smoke-created record ID');
  }
  if (mainFailed) process.exitCode = 1;
}
