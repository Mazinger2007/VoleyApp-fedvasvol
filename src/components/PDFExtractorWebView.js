import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';


function generateHTML(base64) {
  return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">\n<script>\nwindow.onerror = function(msg, url, line) {\n  try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'error\', message: \'JS: \' + msg + \' (line \' + line + \')\' })); } catch(e) {}\n};\n</script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>\n<script>\n' +
'pdfjsLib.GlobalWorkerOptions.workerSrc = \'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js\';\n' +
'var PDF_BASE64 = ' + JSON.stringify(base64) + ';\n' +
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
'    clearTimeout(extractionTimeout);\n' +
'    window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'result\', pages: pages }));\n' +
'  } catch(err) {\n' +
'    clearTimeout(extractionTimeout);\n' +
'    window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'error\', message: err.message }));\n' +
'  }\n' +
'})();\n' +
'</script>\n</head>\n<body style="background:#fff;"></body>\n</html>';
}


export default function PDFExtractorWebView({ pdfBase64, onData, onError }) {
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
            if (data.type === 'result') onData(data.pages);
            else if (data.type === 'error') onError(data.message);
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
