'use client';

/**
 * Hook to read files reliably as data URLs
 * Handles the async nature of FileReader properly
 */
export function useFileReader() {
  const readAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!(file instanceof File)) {
        reject(new Error('Input must be a File object'));
        return;
      }

      const reader = new FileReader();

      const handleLoad = () => {
        try {
          const result = reader.result;
          if (typeof result === 'string') {
            resolve(result);
          } else if (result instanceof ArrayBuffer) {
            const view = new Uint8Array(result);
            let binary = '';
            for (let i = 0; i < view.length; i++) {
              binary += String.fromCharCode(view[i]);
            }
            resolve('data:application/octet-stream;base64,' + btoa(binary));
          } else {
            reject(new Error('FileReader returned unexpected result type'));
          }
        } catch (error) {
          reject(error);
        }
      };

      const handleError = () => {
        reject(new Error(`FileReader error: ${reader.error?.message || 'Unknown error'}`));
      };

      const handleAbort = () => {
        reject(new Error('FileReader was aborted'));
      };

      reader.addEventListener('load', handleLoad);
      reader.addEventListener('error', handleError);
      reader.addEventListener('abort', handleAbort);

      reader.readAsDataURL(file);
    });
  };

  return { readAsDataURL };
}
