import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Package, FileText, Tag } from "lucide-react";
import JsBarcode from "jsbarcode";

function printHtml(html, title = "Печать") {
  const win = window.open("", "_blank", "width=800,height=600");
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; background: #fff; }
        .page { padding: 10mm; }
        .label-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
        .label {
          border: 1px solid #333; padding: 5mm; width: 60mm; min-height: 40mm;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; break-inside: avoid;
        }
        .label .barcode-area {
          font-family: 'Courier New', monospace; font-size: 10px; letter-spacing: 2px;
          margin: 3mm 0; border: 1px solid #ccc; padding: 2mm 4mm; background: #f9f9f9;
          width: 100%;
        }
        .label .sku { font-size: 11px; font-weight: bold; }
        .label .name { font-size: 9px; color: #555; margin-top: 1mm; word-break: break-word; }
        .label .barcode-num { font-size: 8px; color: #888; margin-top: 1mm; }
        .barcode-svg { width: 100%; margin: 2mm 0; display: flex; justify-content: center; }
        .barcode-svg svg { width: 100%; max-width: 56mm; height: auto; }
        .barcode-fallback {
          border: 1px dashed #666; color: #111; font-size: 10px; padding: 2mm 3mm;
          text-align: center; width: 100%;
        }
        .barcode-bars {
          display: flex; align-items: flex-end; height: 15mm; gap: 0.3mm;
          justify-content: center; margin: 2mm 0;
        }
        .bar { background: #000; width: 1mm; }
        .packing-list { padding: 10mm; }
        .packing-list h1 { font-size: 18px; margin-bottom: 5mm; }
        .packing-list h2 { font-size: 14px; margin-bottom: 3mm; color: #333; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 10mm; margin-bottom: 7mm; }
        .meta-item .label-t { font-size: 9px; color: #888; text-transform: uppercase; }
        .meta-item .val { font-size: 12px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 3mm; }
        th, td { border: 1px solid #ddd; padding: 2mm 3mm; text-align: left; font-size: 11px; }
        th { background: #f0f0f0; font-weight: bold; }
        .footer { margin-top: 10mm; font-size: 9px; color: #aaa; border-top: 1px solid #eee; padding-top: 3mm; }
        .separator { border: none; border-top: 2px dashed #ccc; margin: 10mm 0; }
        .box-label {
          border: 3px solid #000; padding: 5mm; margin-bottom: 5mm;
          break-inside: avoid;
        }
        .box-label .order-num { font-size: 20px; font-weight: bold; letter-spacing: 2px; }
        .box-label .dest { font-size: 13px; margin-top: 2mm; }
        .box-label .mp { font-size: 12px; color: #555; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .no-print { display: none; }
          @page { margin: 5mm; }
        }
      </style>
    </head>
    <body>${html}
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  win.document.close();
}

function createCode128Svg(value) {
  const barcodeValue = String(value || "NO-BARCODE").trim() || "NO-BARCODE";

  try {
    const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svgNode, barcodeValue, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      height: 42,
      width: 1.4,
    });
    return svgNode.outerHTML;
  } catch {
    return `<div class="barcode-fallback">${barcodeValue}</div>`;
  }
}

export function PrintProductLabels({ items, orderId }) {
  const labelsHtml = items.flatMap((item) => {
    const barcodeValue = item.barcode || item.product_barcode || item.sku || item.product_name || "NO-BARCODE";
    const quantity = Math.max(1, Number(item.quantity || item.expected_qty || 1));

    return Array.from({ length: quantity }, (_, index) => `
    <div class="label">
      <div class="sku">${item.sku || "—"}</div>
      <div class="barcode-svg">${createCode128Svg(barcodeValue)}</div>
      <div class="barcode-area">${barcodeValue}</div>
      <div class="name">${item.product_name || "Товар"}</div>
      <div class="barcode-num">Заказ: ${orderId} | Этикетка ${index + 1}/${quantity}</div>
    </div>
  `);
  }).join("");

  const html = `
    <div class="page">
      <h2 style="margin-bottom:5mm;font-size:13px;color:#555">Этикетки товаров — Заказ ${orderId}</h2>
      <div class="label-grid">${labelsHtml}</div>
    </div>
  `;

  return (
    <Button variant="outline" size="sm" onClick={() => printHtml(html, `Этикетки — ${orderId}`)}>
      <Tag className="h-4 w-4 mr-2" /> Этикетки товаров
    </Button>
  );
}

export function PrintBoxLabel({ order }) {
  const barcodeValue = order.order_number || "NO-ORDER";

  const html = `
    <div class="page">
      <div class="box-label">
        <div style="font-size:9px;color:#888;margin-bottom:2mm">ЯРЛЫК КОРОБА</div>
        <div class="order-num">${order.order_number}</div>
        <div class="dest">📦 ${order.destination_warehouse}</div>
        <div class="mp">Маркетплейс: ${order.marketplace}</div>
        <div style="margin-top:3mm">
          <div class="barcode-svg">${createCode128Svg(barcodeValue)}</div>
          <div class="barcode-area">${barcodeValue}</div>
        </div>
        <div style="margin-top:2mm;font-size:10px">
          Упаковка: ${order.packaging_type || "—"} | Позиций: ${order.items?.length || 0}
        </div>
      </div>
    </div>
  `;

  return (
    <Button variant="outline" size="sm" onClick={() => printHtml(html, `Ярлык короба — ${order.order_number}`)}>
      <Package className="h-4 w-4 mr-2" /> Ярлык короба
    </Button>
  );
}

export function PrintPackingList({ order }) {
  const orderBarcode = order.order_number || "NO-ORDER";
  const rowsHtml = (order.items || []).map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${item.product_name || "—"}</td>
      <td>${item.sku || "—"}</td>
      <td style="text-align:center">${item.quantity || 1}</td>
      <td>${item.honest_mark || "—"}</td>
    </tr>
  `).join("");

  const html = `
    <div class="packing-list">
      <h1>Упаковочный лист</h1>
      <h2>${order.order_number}</h2>
      <div style="max-width:80mm;margin-bottom:5mm">
        <div class="barcode-svg">${createCode128Svg(orderBarcode)}</div>
        <div class="barcode-area">${orderBarcode}</div>
      </div>
      <div class="meta-grid">
        <div class="meta-item"><div class="label-t">Клиент</div><div class="val">${order.client_name || order.client_email}</div></div>
        <div class="meta-item"><div class="label-t">Маркетплейс</div><div class="val">${order.marketplace}</div></div>
        <div class="meta-item"><div class="label-t">Склад назначения</div><div class="val">${order.destination_warehouse}</div></div>
        <div class="meta-item"><div class="label-t">Тип упаковки</div><div class="val">${order.packaging_type || "—"}</div></div>
        <div class="meta-item"><div class="label-t">Статус</div><div class="val">${order.status}</div></div>
        <div class="meta-item"><div class="label-t">Дата</div><div class="val">${order.shipped_date ? new Date(order.shipped_date).toLocaleDateString("ru-RU") : "—"}</div></div>
      </div>
      ${order.comment ? `<div style="margin-bottom:5mm;font-size:11px;color:#555">Примечание: ${order.comment}</div>` : ""}
      <table>
        <thead>
          <tr><th>#</th><th>Наименование</th><th>Артикул</th><th>Кол-во</th><th>Честный знак</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align:right;font-weight:bold">ИТОГО:</td>
            <td style="text-align:center;font-weight:bold">${(order.items || []).reduce((s, i) => s + (i.quantity || 0), 0)} шт.</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div class="footer">
        Сгенерировано: ${new Date().toLocaleString("ru-RU")} | WMS Fulfillment System
      </div>
    </div>
  `;

  return (
    <Button variant="outline" size="sm" onClick={() => printHtml(html, `Упаковочный лист — ${order.order_number}`)}>
      <FileText className="h-4 w-4 mr-2" /> Упаковочный лист
    </Button>
  );
}

export default function PrintDocumentsMenu({ order, type = "assembly" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4 mr-2" /> Печать документов
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Печать документов
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Выберите тип документа для печати:</p>
            <div className="flex flex-col gap-2">
              <PrintProductLabels items={order.items || []} orderId={order.order_number} />
              <PrintBoxLabel order={order} />
              <PrintPackingList order={order} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}