export type PDFHighlight = {
  page: number;
  text: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  color: string;
  timestamp: number;
};

export type PDFBookmark = {
  id: string;
  fileUri: string;
  fileName: string;
  displayName: string;
  totalPages: number;
  createdAt: number;
  lastOpened: number;
  currentPage: number;
  highlights: PDFHighlight[];
  notes: {
    [page: number]: string;
  };
};

export type PDFLibrary = {
  books: PDFBookmark[];
};

/**
 * Crea un nuevo marcador de PDF
 */
export function createPDFBookmark(
  fileUri: string,
  fileName: string,
  displayName: string,
  totalPages: number = 1
): PDFBookmark {
  return {
    id: `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fileUri,
    fileName,
    displayName,
    totalPages,
    createdAt: Date.now(),
    lastOpened: Date.now(),
    currentPage: 1,
    highlights: [],
    notes: {},
  };
}

/**
 * Agrega un highlight a un PDF
 */
export function addHighlightToPDF(
  bookmark: PDFBookmark,
  page: number,
  text: string,
  color: string = '#FFFF00'
): PDFHighlight {
  const highlight: PDFHighlight = {
    page,
    text,
    color,
    timestamp: Date.now(),
  };

  bookmark.highlights.push(highlight);
  return highlight;
}

/**
 * Elimina un highlight de un PDF
 */
export function removeHighlightFromPDF(
  bookmark: PDFBookmark,
  highlightId: number
): void {
  bookmark.highlights.splice(highlightId, 1);
}

/**
 * Agrega una nota a una página
 */
export function addNoteToPDF(
  bookmark: PDFBookmark,
  page: number,
  note: string
): void {
  bookmark.notes[page] = note;
}

/**
 * Actualiza el progreso de lectura
 */
export function updatePDFProgress(
  bookmark: PDFBookmark,
  currentPage: number
): void {
  bookmark.currentPage = currentPage;
  bookmark.lastOpened = Date.now();
}
