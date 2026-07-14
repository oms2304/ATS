import '@testing-library/jest-dom';
import {
  apiDownloadBlob,
  apiFetch,
  downloadDocumentVersion,
  uploadDocumentFormData,
} from '../api';

describe('API transport helpers', () => {
  const fetchMock = jest.fn();
  const clickMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    global.fetch = fetchMock;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:test-download'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(clickMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends JSON requests with the bearer token and content type', async () => {
    localStorage.setItem('token', 'test-token');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await apiFetch('/api/example', {
      method: 'POST',
      body: JSON.stringify({ title: 'Example' }),
    });

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('lets the browser set the multipart boundary for document uploads', async () => {
    localStorage.setItem('auth_token', 'legacy-token');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    const file = new File(['resume'], 'resume.txt', { type: 'text/plain' });

    await uploadDocumentFormData(file, 'resume', 'My Resume');

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer legacy-token');
    expect(headers.has('Content-Type')).toBe(false);
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get('file')).toBe(file);
    expect((options.body as FormData).get('title')).toBe('My Resume');
  });

  it('downloads the authenticated blob with the server-provided filename', async () => {
    localStorage.setItem('token', 'test-token');
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({
        'Content-Disposition':
          "attachment; filename*=UTF-8''resume%20final.pdf",
      }),
      blob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
    });

    await downloadDocumentVersion('doc-1', 'version-2', 'fallback.pdf');

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/api/documents/doc-1/versions/version-2/download'
    );
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-download');
  });

  it('surfaces download API errors with status and response data', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: 'Document not found' }),
    });

    await expect(apiDownloadBlob('/api/missing')).rejects.toMatchObject({
      message: 'Document not found',
      status: 404,
      data: { success: false, error: 'Document not found' },
    });
  });
});
