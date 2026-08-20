import React from 'react';

interface ReceiptProps {
  storeName: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  change: number;
}

export const ThermalReceipt: React.FC<ReceiptProps> = ({
  storeName,
  invoiceNumber,
  date,
  customerName,
  items,
  subtotal,
  discount,
  tax,
  total,
  paid,
  change,
}) => {
  return (
    <div className="hidden print:block font-mono text-black text-sm w-[80mm] mx-auto p-4 leading-tight bg-white">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold mb-1">{storeName}</h1>
        <p>فاتورة مبيعات</p>
      </div>
      
      <div className="mb-4 text-xs border-b border-black pb-2 border-dashed">
        <div className="flex justify-between">
          <span>رقم الفاتورة:</span>
          <span>{invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>التاريخ:</span>
          <span>{date}</span>
        </div>
        <div className="flex justify-between">
          <span>العميل:</span>
          <span>{customerName}</span>
        </div>
      </div>

      <table className="w-full text-xs mb-4">
        <thead>
          <tr className="border-b border-black border-dashed">
            <th className="text-right py-1">الصنف</th>
            <th className="text-center py-1 w-12">كمية</th>
            <th className="text-center py-1 w-16">سعر</th>
            <th className="text-left py-1 w-16">المجموع</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="text-right py-1 pr-1">{item.name}</td>
              <td className="text-center py-1">{item.quantity}</td>
              <td className="text-center py-1">{item.unitPrice.toFixed(2)}</td>
              <td className="text-left py-1">{item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-black border-dashed pt-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span>المجموع الفرعي:</span>
          <span>{subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span>الخصم:</span>
            <span>{discount.toFixed(2)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between">
            <span>الضريبة:</span>
            <span>{tax.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm mt-2 border-t border-black pt-1">
          <span>الإجمالي:</span>
          <span>{total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mt-2">
          <span>المدفوع:</span>
          <span>{paid.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>المتبقي:</span>
          <span>{change.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center mt-6 text-xs">
        <p>شكراً لزيارتكم</p>
      </div>

      {/* Global CSS for printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
        }
      `}} />
    </div>
  );
};
