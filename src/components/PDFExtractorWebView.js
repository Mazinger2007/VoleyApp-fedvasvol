import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';


function generateHTML(base64) {
  return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">\n<script>\nwindow.onerror = function(msg, url, line) {\n  try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'error\', message: \'JS: \' + msg + \' (line \' + line + \')\' })); } catch(e) {}\n};\n</script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>\n<script>\n' +
'pdfjsLib.GlobalWorkerOptions.workerSrc = \'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js\';\n' +
'var PDF_BASE64 = ' + JSON.stringify(base64) + ';\n' +
'\n' +
'function loadTesseract() {\n' +
'  return new Promise(function(resolve, reject) {\n' +
'    if (window.Tesseract) { resolve(); return; }\n' +
'    var s = document.createElement(\'script\');\n' +
'    s.src = \'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js\';\n' +
'    s.onload = function() {\n' +
'      window.Tesseract.langPath = \'https://tessdata.projectnaptha.com/4.0.0/\';\n' +
'      resolve();\n' +
'    };\n' +
'    s.onerror = reject;\n' +
'    document.head.appendChild(s);\n' +
'  });\n' +
'}\n' +
'\n' +
'function sendProgress(msg) {\n' +
'  try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'progress\', message: msg })); } catch(e) {}\n' +
'}\n' +
'\n' +
'async function extractOcrText(doc) {\n' +
'  var fullText = \'\';\n' +
'  for (var p = 1; p <= doc.numPages; p++) {\n' +
'    sendProgress(\'Procesando pagina \' + p + \' de \' + doc.numPages + \'...\');\n' +
'    var page = await doc.getPage(p);\n' +
'    var viewport = page.getViewport({ scale: 3 });\n' +
'    var canvas = document.createElement(\'canvas\');\n' +
'    canvas.width = viewport.width;\n' +
'    canvas.height = viewport.height;\n' +
'    canvas.style.position = \'absolute\'; canvas.style.left = \'-9999px\'; canvas.style.top = \'-9999px\';\n' +
'    document.body.appendChild(canvas);\n' +
'    var ctx = canvas.getContext(\'2d\');\n' +
'    ctx.fillStyle = \'#fff\';\n' +
'    ctx.fillRect(0, 0, canvas.width, canvas.height);\n' +
'    try { await page.render({ canvasContext: ctx, viewport: viewport }).promise; } catch(e) { document.body.removeChild(canvas); throw e; }\n' +
'    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);\n' +
'    var d = imageData.data;\n' +
'    var w = canvas.width, h = canvas.height;\n' +
'    var pixels = w * h;\n' +
'    var gray = new Uint8Array(pixels);\n' +
'    for (var i = 0, j = 0; i < d.length; i += 4, j++) {\n' +
'      gray[j] = (0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]) | 0;\n' +
'    }\n' +
'    var blurred = new Uint8Array(gray);\n' +
'    for (var y = 1; y < h - 1; y++) {\n' +
'      for (var x = 1; x < w - 1; x++) {\n' +
'        var n = [];\n' +
'        for (var ky = -1; ky <= 1; ky++) {\n' +
'          for (var kx = -1; kx <= 1; kx++) {\n' +
'            n.push(gray[(y + ky) * w + (x + kx)]);\n' +
'          }\n' +
'        }\n' +
'        n.sort(function(a, b) { return a - b; });\n' +
'        blurred[y * w + x] = n[4];\n' +
'      }\n' +
'    }\n' +
'    var hist = [];\n' +
'    for (var i = 0; i < 256; i++) hist[i] = 0;\n' +
'    for (var i = 0; i < pixels; i++) hist[blurred[i]]++;\n' +
'    var total = pixels;\n' +
'    var sum = 0;\n' +
'    for (var i = 0; i < 256; i++) sum += i * hist[i];\n' +
'    var sumB = 0, wB = 0, maxVar = 0, threshold = 128;\n' +
'    for (var i = 0; i < 256; i++) {\n' +
'      wB += hist[i];\n' +
'      if (wB === 0) continue;\n' +
'      var wF = total - wB;\n' +
'      if (wF === 0) break;\n' +
'      sumB += i * hist[i];\n' +
'      var mB = sumB / wB;\n' +
'      var mF = (sum - sumB) / wF;\n' +
'      var v = wB * wF * (mB - mF) * (mB - mF);\n' +
'      if (v > maxVar) { maxVar = v; threshold = i; }\n' +
'    }\n' +
'    for (var i = 0, j = 0; i < d.length; i += 4, j++) {\n' +
'      if (blurred[j] < threshold) { d[i] = d[i+1] = d[i+2] = 0; }\n' +
'      else { d[i] = d[i+1] = d[i+2] = 255; }\n' +
'    }\n' +
'    ctx.putImageData(imageData, 0, 0);\n' +
'    sendProgress(\'Ejecutando OCR pagina \' + p + \'...\');\n' +
'    var result = await Tesseract.recognize(canvas, \'spa\');\n' +
'    fullText += result.data.text + \'\\n\';\n' +
'    document.body.removeChild(canvas);\n' +
'  }\n' +
'  return fullText;\n' +
'}\n' +
'\n' +
'(async function() {\n' +
'  try {\n' +
'    var extractionTimeout = setTimeout(function() {\n' +
'      window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'error\', message: \'Timeout: extraccion demasiado lenta\' }));\n' +
'    }, 25000);\n' +
'    var raw = atob(PDF_BASE64);\n' +
'    var arr = new Uint8Array(raw.length);\n' +
'    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);\n' +
'    var doc = await pdfjsLib.getDocument({ data: arr }).promise;\n' +
'    var pages = [];\n' +
'    for (var p = 1; p <= doc.numPages; p++) {\n' +
'      var page = await doc.getPage(p);\n' +
'      var content = await page.getTextContent();\n' +
'      var viewport = page.getViewport({ scale: 1 });\n' +
'      var items = [];\n' +
'      for (var j = 0; j < content.items.length; j++) {\n' +
'        var item = content.items[j];\n' +
'        if (!item.str || item.str.trim().length === 0) continue;\n' +
'        items.push({\n' +
'          text: item.str,\n' +
'          x: Math.round(item.transform[4] * 10) / 10,\n' +
'          y: Math.round((viewport.height - item.transform[5]) * 10) / 10,\n' +
'          w: Math.round(item.width * 10) / 10,\n' +
'        });\n' +
'      }\n' +
'      pages.push({ page: p, items: items, width: viewport.width, height: viewport.height });\n' +
'    }\n' +
'    var totalItems = 0;\n' +
'    for (var pi = 0; pi < pages.length; pi++) totalItems += pages[pi].items.length;\n' +
'    clearTimeout(extractionTimeout);\n' +
'    if (totalItems === 0) {\n' +
'      sendProgress(\'PDF sin texto, iniciando OCR...\');\n' +
'      await loadTesseract();\n' +
'      sendProgress(\'Tesseract cargado, procesando...\');\n' +
'      var ocrTimeout = setTimeout(function() {\n' +
'        window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'error\', message: \'Timeout: OCR demasiado lento (>120s)\' }));\n' +
'      }, 120000);\n' +
'      var ocrText = await extractOcrText(doc);\n' +
'      clearTimeout(ocrTimeout);\n' +
'      sendProgress(\'OCR completado, analizando...\');\n' +
'      window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'result\', pages: pages, ocrText: ocrText }));\n' +
'    } else {\n' +
'      window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'result\', pages: pages }));\n' +
'    }\n' +
'  } catch(err) {\n' +
'    clearTimeout(extractionTimeout);\n' +
'    window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'error\', message: err.message }));\n' +
'  }\n' +
'})();\n' +
'</script>\n</head>\n<body style="background:#fff;"></body>\n</html>';
}


export default function PDFExtractorWebView({ pdfBase64, onData, onError, onProgress }) {
  const html = useMemo(() => generateHTML(pdfBase64), [pdfBase64]);

  return (
    <View style={styles.hidden}>
      <WebView
        source={{ html }}
        style={styles.hidden}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'result') onData(data.pages, data.ocrText);
            else if (data.type === 'error') onError(data.message);
            else if (data.type === 'progress' && onProgress) onProgress(data.message);
          } catch (e) { /* ignore */ }
        }}
        onError={() => onError('WebView load error')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { width: 1, height: 1, opacity: 0, position: 'absolute', top: -1000, left: -1000 },
});
