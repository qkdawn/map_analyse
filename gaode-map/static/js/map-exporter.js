// 导出功能的按钮事件绑定
function setupExportButtons() {
    var exportXlsxBtn = document.getElementById('btnExportXlsx');
    var exportImgBtn = document.getElementById('btnExportImage');
    var mapContainer = document.getElementById('container');
    var currentMapId = typeof window.mapId !== 'undefined' ? window.mapId : null;

    function setBusy(btn, busy) {
        if (!btn) return;
        btn.disabled = busy;
        btn.textContent = busy ? '处理中...' : btn.dataset.originalText || btn.textContent;
    }

    if (exportXlsxBtn) {
        exportXlsxBtn.dataset.originalText = exportXlsxBtn.textContent;
        if (!currentMapId) {
            exportXlsxBtn.disabled = true;
            exportXlsxBtn.title = '缺少 mapId，无法导出';
        } else {
            exportXlsxBtn.addEventListener('click', async function() {
                setBusy(exportXlsxBtn, true);
                try {
                    var res = await fetch('/api/v1/maps/' + currentMapId + '/export/xlsx');
                    if (!res.ok) {
                        throw new Error('导出接口返回错误 ' + res.status);
                    }
                    var blob = await res.blob();
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'map_' + currentMapId + '_data.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                } catch (err) {
                    alert('导出表格失败：' + err.message);
                } finally {
                    setBusy(exportXlsxBtn, false);
                }
            });
        }
    }

    if (exportImgBtn) {
        exportImgBtn.dataset.originalText = exportImgBtn.textContent;
        exportImgBtn.addEventListener('click', async function() {
            if (typeof html2canvas !== 'function') {
                alert('截图库未加载，请稍后重试');
                return;
            }
            if (!mapContainer) {
                alert('找不到地图容器');
                return;
            }
            setBusy(exportImgBtn, true);
            try {
                var canvas = await html2canvas(mapContainer, { useCORS: true });
                canvas.toBlob(function(blob) {
                    if (!blob) {
                        alert('导出图片失败：未生成图像');
                        setBusy(exportImgBtn, false);
                        return;
                    }
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'map_' + (currentMapId || 'preview') + '.png';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    setBusy(exportImgBtn, false);
                }, 'image/png');
            } catch (err) {
                alert('导出图片失败：' + err.message);
                setBusy(exportImgBtn, false);
            }
        });
    }
}

// 等待 DOM 与模板变量准备完毕后再绑定，避免 mapId 未定义。
window.addEventListener('DOMContentLoaded', setupExportButtons);
