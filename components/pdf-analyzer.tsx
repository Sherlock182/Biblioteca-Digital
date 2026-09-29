import { isViewerNavigation, loadPDFViewerSource, PDFAnalysis, PDFViewerSource, sendPDFData } from '@/constants/pdf-webview-bridge';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

type Job = {
  id: number; source: PDFViewerSource; base64: string;
  resolve: (analysis: PDFAnalysis) => void; reject: (error: Error) => void;
};

const TIMEOUT_MS = 90000;

/**
 * Runs PDF.js in an invisible WebView to check whether a document has real, readable text
 * before it enters the library. Render `element` somewhere in the screen.
 */
export function usePDFAnalyzer() {
  const [job, setJob] = useState<Job | null>(null);
  const viewer = useRef<WebView>(null);
  const jobRef = useRef<Job | null>(null);
  const nextId = useRef(0);

  const finish = useCallback((id: number, outcome: { analysis?: PDFAnalysis; error?: Error }) => {
    const current = jobRef.current;
    if (!current || current.id !== id) return;
    jobRef.current = null;
    setJob(null);
    if (outcome.analysis) current.resolve(outcome.analysis);
    else current.reject(outcome.error || new Error('No se pudo analizar el documento.'));
  }, []);

  useEffect(() => () => {
    const current = jobRef.current;
    jobRef.current = null;
    current?.reject(new Error('Se canceló el análisis del documento.'));
  }, []);

  useEffect(() => {
    if (!job) return;
    const timer = setTimeout(() => finish(job.id, {
      error: new Error('El análisis del documento tardó demasiado. Inténtalo de nuevo.'),
    }), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [job, finish]);

  const analyze = useCallback(async (base64: string): Promise<PDFAnalysis> => {
    const source = await loadPDFViewerSource();
    return new Promise<PDFAnalysis>((resolve, reject) => {
      jobRef.current?.reject(new Error('Se inició otro análisis.'));
      const next: Job = { id: ++nextId.current, source, base64, resolve, reject };
      jobRef.current = next;
      setJob(next);
    });
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    const current = jobRef.current;
    if (!current) return;
    let message: { type?: string; error?: unknown } & Partial<PDFAnalysis>;
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    const inject = (script: string) => viewer.current?.injectJavaScript(script + ';true;');
    if (message.type === 'VIEWER_READY') {
      void sendPDFData(inject, current.base64, undefined, () => jobRef.current?.id !== current.id)
        .then(sent => { if (sent) inject('window.analyzePDF()'); });
    } else if (message.type === 'ANALYSIS' && typeof message.verdict === 'string') {
      finish(current.id, { analysis: message as PDFAnalysis });
    } else if (message.type === 'PDF_ERROR') {
      finish(current.id, { error: new Error(String(message.error)) });
    }
  }, [finish]);

  const fail = useCallback((error: string) => {
    const current = jobRef.current;
    if (current) finish(current.id, { error: new Error(error) });
  }, [finish]);

  const element = job ? <View style={styles.hidden} pointerEvents="none">
    <WebView key={job.id} ref={viewer} source={job.source} onMessage={onMessage}
      originWhitelist={['*']} javaScriptEnabled
      onShouldStartLoadWithRequest={request => isViewerNavigation(request.url)}
      onError={event => fail(event.nativeEvent.description || 'No se pudo iniciar el analizador.')}
      onRenderProcessGone={() => fail('Android cerró el analizador por falta de memoria. Prueba con un PDF más pequeño.')}
      onContentProcessDidTerminate={() => fail('El analizador se cerró inesperadamente. Inténtalo de nuevo.')} />
  </View> : null;

  return { analyze, element, analyzing: !!job };
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 2, height: 2, left: 0, bottom: 0, opacity: 0, overflow: 'hidden' },
});
