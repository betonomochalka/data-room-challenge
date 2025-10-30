import { renderHook } from '@testing-library/react';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Folder } from '../../types';

describe('useBreadcrumbs Hook', () => {
  const mockDataRoomId = 'room-123';
  const mockDataRoomName = 'My Data Room';

  const createMockFolder = (id: string, name: string, parentId: string | null = null): Folder => ({
    id,
    name,
    parentId,
    dataRoomId: mockDataRoomId,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  });

  describe('Data Room Root', () => {
    it('returns only data room breadcrumb when no folder is selected', () => {
      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
          dataRoomName: mockDataRoomName,
        })
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual({
        id: mockDataRoomId,
        name: mockDataRoomName,
        path: `/data-rooms/${mockDataRoomId}`,
      });
    });

    it('uses fallback name when dataRoomName is not provided', () => {
      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
        })
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('Data Room');
    });
  });

  describe('Single Folder', () => {
    it('builds breadcrumb for a single root-level folder', () => {
      const folder = createMockFolder('folder-1', 'Documents', null);

      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
          dataRoomName: mockDataRoomName,
          currentFolderId: folder.id,
          currentFolderName: folder.name,
          allFolders: [folder],
        })
      );

      expect(result.current).toHaveLength(2);
      expect(result.current[0].name).toBe(mockDataRoomName);
      expect(result.current[1]).toEqual({
        id: 'folder-1',
        name: 'Documents',
        path: `/data-rooms/${mockDataRoomId}/folders/folder-1`,
      });
    });

    it('uses fallback when allFolders is empty', () => {
      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
          dataRoomName: mockDataRoomName,
          currentFolderId: 'folder-1',
          currentFolderName: 'Documents',
          allFolders: [],
        })
      );

      expect(result.current).toHaveLength(2);
      expect(result.current[1]).toEqual({
        id: 'folder-1',
        name: 'Documents',
        path: `/data-rooms/${mockDataRoomId}/folders/folder-1`,
      });
    });
  });

  describe('Nested Folders', () => {
    it('builds breadcrumb trail for nested folders (2 levels)', () => {
      const parentFolder = createMockFolder('folder-1', 'Documents', null);
      const childFolder = createMockFolder('folder-2', 'Reports', 'folder-1');

      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
          dataRoomName: mockDataRoomName,
          currentFolderId: childFolder.id,
          currentFolderName: childFolder.name,
          allFolders: [parentFolder, childFolder],
        })
      );

      expect(result.current).toHaveLength(3);
      expect(result.current[0].name).toBe(mockDataRoomName);
      expect(result.current[1].name).toBe('Documents');
      expect(result.current[2].name).toBe('Reports');
    });

    it('builds breadcrumb trail for deeply nested folders (3 levels)', () => {
      const folder1 = createMockFolder('folder-1', 'Documents', null);
      const folder2 = createMockFolder('folder-2', 'Reports', 'folder-1');
      const folder3 = createMockFolder('folder-3', '2024', 'folder-2');

      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
          dataRoomName: mockDataRoomName,
          currentFolderId: folder3.id,
          currentFolderName: folder3.name,
          allFolders: [folder1, folder2, folder3],
        })
      );

      expect(result.current).toHaveLength(4);
      expect(result.current[0].name).toBe(mockDataRoomName);
      expect(result.current[1].name).toBe('Documents');
      expect(result.current[2].name).toBe('Reports');
      expect(result.current[3].name).toBe('2024');
    });

    it('handles very deep nesting (5 levels)', () => {
      const folder1 = createMockFolder('folder-1', 'Level 1', null);
      const folder2 = createMockFolder('folder-2', 'Level 2', 'folder-1');
      const folder3 = createMockFolder('folder-3', 'Level 3', 'folder-2');
      const folder4 = createMockFolder('folder-4', 'Level 4', 'folder-3');
      const folder5 = createMockFolder('folder-5', 'Level 5', 'folder-4');

      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
          dataRoomName: mockDataRoomName,
          currentFolderId: folder5.id,
          currentFolderName: folder5.name,
          allFolders: [folder1, folder2, folder3, folder4, folder5],
        })
      );

      expect(result.current).toHaveLength(6); // Data room + 5 folders
      expect(result.current.map(b => b.name)).toEqual([
        mockDataRoomName,
        'Level 1',
        'Level 2',
        'Level 3',
        'Level 4',
        'Level 5',
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('handles missing parent folder in the list', () => {
      const childFolder = createMockFolder('folder-2', 'Reports', 'folder-1');
      // Parent folder is not in the list

      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
          dataRoomName: mockDataRoomName,
          currentFolderId: childFolder.id,
          currentFolderName: childFolder.name,
          allFolders: [childFolder],
        })
      );

      // Should still build what it can
      expect(result.current).toHaveLength(2);
      expect(result.current[1].name).toBe('Reports');
    });

    it('handles circular reference protection', () => {
      // Mock console.warn to suppress warning in test output
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // This shouldn't happen in real data, but let's ensure it doesn't cause infinite loop
      const folder1 = createMockFolder('folder-1', 'Folder 1', 'folder-2');
      const folder2 = createMockFolder('folder-2', 'Folder 2', 'folder-1');

      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
          dataRoomName: mockDataRoomName,
          currentFolderId: folder1.id,
          currentFolderName: folder1.name,
          allFolders: [folder1, folder2],
        })
      );

      // Should not crash, just build what makes sense
      expect(result.current.length).toBeGreaterThan(0);
      
      // Verify the warning was called
      expect(consoleWarnSpy).toHaveBeenCalledWith('Circular reference detected in folder hierarchy');
      
      // Restore console.warn
      consoleWarnSpy.mockRestore();
    });

    it('handles empty folder name', () => {
      const folder = createMockFolder('folder-1', '', null);

      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
          dataRoomName: mockDataRoomName,
          currentFolderId: folder.id,
          currentFolderName: folder.name,
          allFolders: [folder],
        })
      );

      expect(result.current).toHaveLength(2);
      expect(result.current[1].name).toBe('');
    });
  });

  describe('Memoization', () => {
    it('returns same reference when dependencies do not change', () => {
      const folder = createMockFolder('folder-1', 'Documents', null);
      const allFolders = [folder];

      const { result, rerender } = renderHook(
        (props) => useBreadcrumbs(props),
        {
          initialProps: {
            dataRoomId: mockDataRoomId,
            dataRoomName: mockDataRoomName,
            currentFolderId: folder.id,
            currentFolderName: folder.name,
            allFolders,
          },
        }
      );

      const firstResult = result.current;

      // Rerender with same props
      rerender({
        dataRoomId: mockDataRoomId,
        dataRoomName: mockDataRoomName,
        currentFolderId: folder.id,
        currentFolderName: folder.name,
        allFolders,
      });

      // Should return same reference (memoized)
      expect(result.current).toBe(firstResult);
    });

    it('returns new reference when folder changes', () => {
      const folder1 = createMockFolder('folder-1', 'Documents', null);
      const folder2 = createMockFolder('folder-2', 'Reports', null);
      const allFolders = [folder1, folder2];

      const { result, rerender } = renderHook(
        (props) => useBreadcrumbs(props),
        {
          initialProps: {
            dataRoomId: mockDataRoomId,
            dataRoomName: mockDataRoomName,
            currentFolderId: folder1.id,
            currentFolderName: folder1.name,
            allFolders,
          },
        }
      );

      const firstResult = result.current;

      // Change to different folder
      rerender({
        dataRoomId: mockDataRoomId,
        dataRoomName: mockDataRoomName,
        currentFolderId: folder2.id,
        currentFolderName: folder2.name,
        allFolders,
      });

      // Should return different reference
      expect(result.current).not.toBe(firstResult);
      expect(result.current[1].name).toBe('Reports');
    });
  });

  describe('Path Generation', () => {
    it('generates correct paths for all breadcrumb items', () => {
      const folder1 = createMockFolder('folder-1', 'Documents', null);
      const folder2 = createMockFolder('folder-2', 'Reports', 'folder-1');

      const { result } = renderHook(() =>
        useBreadcrumbs({
          dataRoomId: mockDataRoomId,
          dataRoomName: mockDataRoomName,
          currentFolderId: folder2.id,
          currentFolderName: folder2.name,
          allFolders: [folder1, folder2],
        })
      );

      expect(result.current[0].path).toBe(`/data-rooms/${mockDataRoomId}`);
      expect(result.current[1].path).toBe(`/data-rooms/${mockDataRoomId}/folders/folder-1`);
      expect(result.current[2].path).toBe(`/data-rooms/${mockDataRoomId}/folders/folder-2`);
    });
  });
});

