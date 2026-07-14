import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { HistoryDialog } from '@/components/documents/HistoryDialog';
import { MetadataDialog } from '@/components/documents/MetadataDialog';
import { UploadDocumentDialog } from '@/components/documents/UploadDocumentDialog';
import * as api from '@/lib/api';

expect.extend(toHaveNoViolations);

const PDF_TYPE = 'application/pdf';
const DOCX_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function fileOfSize(name: string, type: string, size: number) {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

jest.mock('@/lib/api', () => ({
  downloadDocumentVersion: jest.fn(),
  getDocumentVersions: jest.fn(),
  updateDocumentMetadata: jest.fn(),
  uploadDocumentFormData: jest.fn(),
}));

const mockDocument = {
  id: 'doc-1',
  type: 'resume',
  title: 'Demo Resume',
  content: 'Resume content',
  versionNumber: 2,
  updatedAt: '2026-01-02T00:00:00.000Z',
  status: 'active',
  tags: ['demo'],
  archivedAt: null,
  job: null,
};

describe('document dialogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the upload footer on the same dark modal surface', () => {
    render(
      <UploadDocumentDialog
        open
        onOpenChange={jest.fn()}
        onUploaded={jest.fn()}
      />
    );

    expect(document.querySelector('[data-slot="dialog-footer"]')).toHaveClass(
      'bg-transparent',
      'border-[#30363d]'
    );
  });

  it('validates unsupported upload types before making an API request', async () => {
    render(
      <UploadDocumentDialog
        open
        onOpenChange={jest.fn()}
        onUploaded={jest.fn()}
      />
    );
    const file = new File(['image'], 'resume.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('File'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    expect(
      await screen.findByText('Only PDF, DOCX, and TXT files are supported.')
    ).toBeInTheDocument();
    expect(api.uploadDocumentFormData).not.toHaveBeenCalled();
  });

  it('uploads a valid file with the filename-derived title', async () => {
    (api.uploadDocumentFormData as jest.Mock).mockResolvedValue({
      success: true,
    });
    const onUploaded = jest.fn();
    render(
      <UploadDocumentDialog
        open
        onOpenChange={jest.fn()}
        onUploaded={onUploaded}
      />
    );
    const file = new File(['resume'], 'alice-resume.txt', {
      type: 'text/plain',
    });
    fireEvent.change(screen.getByLabelText('File'), {
      target: { files: [file] },
    });
    expect(screen.getByLabelText('Title')).toHaveValue('alice-resume');
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() =>
      expect(api.uploadDocumentFormData).toHaveBeenCalledWith(
        file,
        'resume',
        'alice-resume'
      )
    );
    expect(onUploaded).toHaveBeenCalled();
  });

  it('normalizes tags before saving metadata', async () => {
    (api.updateDocumentMetadata as jest.Mock).mockResolvedValue({
      success: true,
    });
    render(
      <MetadataDialog
        document={mockDocument}
        open
        onOpenChange={jest.fn()}
        onSaved={jest.fn()}
      />
    );
    fireEvent.change(
      document.getElementById('metadata-tags') as HTMLInputElement,
      {
        target: { value: ' demo, Demo, brandco ' },
      }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(api.updateDocumentMetadata).toHaveBeenCalledWith('doc-1', {
        title: 'Demo Resume',
        tags: ['demo', 'brandco'],
        status: 'active',
      })
    );
  });

  it('loads and downloads a specific historical version', async () => {
    (api.getDocumentVersions as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'version-2',
          document_id: 'doc-1',
          version_number: 2,
          label: 'Saved revision',
          fileName: null,
          mimeType: null,
          fileSize: null,
          content: 'Resume content',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    });
    (api.downloadDocumentVersion as jest.Mock).mockResolvedValue(undefined);
    render(
      <HistoryDialog document={mockDocument} open onOpenChange={jest.fn()} />
    );

    expect(await screen.findByText(/Version 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() =>
      expect(api.downloadDocumentVersion).toHaveBeenCalledWith(
        'doc-1',
        'version-2',
        'Demo Resume-v2.txt'
      )
    );
  });

  it('rejects a file over 5MiB before making an API request', async () => {
    render(
      <UploadDocumentDialog
        open
        onOpenChange={jest.fn()}
        onUploaded={jest.fn()}
      />
    );
    const oversized = fileOfSize('resume.pdf', PDF_TYPE, 5 * 1024 * 1024 + 1);
    fireEvent.change(screen.getByLabelText('File'), {
      target: { files: [oversized] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    expect(
      await screen.findByText('File must be 5MB or smaller.')
    ).toBeInTheDocument();
    expect(api.uploadDocumentFormData).not.toHaveBeenCalled();
  });

  it.each([
    ['PDF', 'resume.pdf', PDF_TYPE],
    ['DOCX', 'resume.docx', DOCX_TYPE],
  ])('accepts a %s upload at the size limit', async (_label, name, type) => {
    (api.uploadDocumentFormData as jest.Mock).mockResolvedValue({
      success: true,
    });
    render(
      <UploadDocumentDialog
        open
        onOpenChange={jest.fn()}
        onUploaded={jest.fn()}
      />
    );
    const file = fileOfSize(name, type, 5 * 1024 * 1024);
    fireEvent.change(screen.getByLabelText('File'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() =>
      expect(api.uploadDocumentFormData).toHaveBeenCalledWith(
        file,
        'resume',
        'resume'
      )
    );
  });

  it('surfaces the backend field error and keeps the dialog open', async () => {
    const rejection = Object.assign(new Error('Upload failed'), {
      data: { fields: { file: ['Unsupported file format.'] } },
    });
    (api.uploadDocumentFormData as jest.Mock).mockRejectedValue(rejection);
    const onOpenChange = jest.fn();
    render(
      <UploadDocumentDialog
        open
        onOpenChange={onOpenChange}
        onUploaded={jest.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText('File'), {
      target: { files: [fileOfSize('resume.pdf', PDF_TYPE, 1024)] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    expect(
      await screen.findByText('Unsupported file format.')
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  describe('accessibility', () => {
    it('has no violations in the upload dialog', async () => {
      const { baseElement } = render(
        <UploadDocumentDialog
          open
          onOpenChange={jest.fn()}
          onUploaded={jest.fn()}
        />
      );
      expect(await axe(baseElement)).toHaveNoViolations();
    });

    it('has no violations in the metadata dialog', async () => {
      const { baseElement } = render(
        <MetadataDialog
          document={mockDocument}
          open
          onOpenChange={jest.fn()}
          onSaved={jest.fn()}
        />
      );
      expect(await axe(baseElement)).toHaveNoViolations();
    });

    it('has no violations in the history dialog', async () => {
      (api.getDocumentVersions as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });
      const { baseElement } = render(
        <HistoryDialog document={mockDocument} open onOpenChange={jest.fn()} />
      );
      await screen.findByText('No versions are available.');
      expect(await axe(baseElement)).toHaveNoViolations();
    });
  });
});
