import { Contract, Counterparty } from "../drizzle/schema";
import { CONTRACT_TYPES } from "@shared/contracts";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

// HTML template for contract document
export function generateContractHtml(
  contract: Contract,
  counterparty: Counterparty,
  customerName: string = 'ООО "Рога и копыта"'
): string {
  const formatDate = (date: Date | string | null) => {
    if (!date) return "___________";
    return format(new Date(date), "dd MMMM yyyy", { locale: ru });
  };

  const formatAmount = (amount: string | null, notSpecified: boolean) => {
    if (notSpecified) return "Сумма определяется дополнительным соглашением";
    if (!amount) return "___________";
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 2,
    }).format(parseFloat(amount));
  };

  const contractType = CONTRACT_TYPES[contract.contractType as keyof typeof CONTRACT_TYPES]?.label || contract.contractType;

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Договор ${contract.contractNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14px;
      line-height: 1.6;
      color: #000;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 30px;
    }
    h2 {
      font-size: 14px;
      font-weight: bold;
      margin: 20px 0 10px;
      text-align: center;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .parties {
      margin-bottom: 20px;
      text-align: justify;
    }
    .section {
      margin-bottom: 20px;
    }
    .section p {
      text-indent: 30px;
      text-align: justify;
      margin-bottom: 10px;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 50px;
    }
    .signature-block {
      width: 45%;
    }
    .signature-block h3 {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      margin: 30px 0 5px;
      min-height: 20px;
    }
    .signature-name {
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    table td, table th {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
    }
    .amount {
      font-weight: bold;
    }
    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <h1>ДОГОВОР № ${contract.contractNumber}</h1>
  
  <div class="header">
    <span>г. Москва</span>
    <span>${formatDate(contract.contractDate)}</span>
  </div>

  <div class="parties">
    <p>
      <strong>${customerName}</strong>, именуемое в дальнейшем «Заказчик», в лице Директора, 
      действующего на основании Устава, с одной стороны, и 
      <strong>${counterparty.name}</strong>, ИНН ${counterparty.inn}${counterparty.kpp ? `, КПП ${counterparty.kpp}` : ''}, 
      именуемое в дальнейшем «Исполнитель», в лице ${counterparty.directorName || 'Директора'}, 
      действующего на основании Устава, с другой стороны, 
      вместе именуемые «Стороны», заключили настоящий Договор о нижеследующем:
    </p>
  </div>

  <h2>1. ПРЕДМЕТ ДОГОВОРА</h2>
  <div class="section">
    <p>
      1.1. Исполнитель обязуется выполнить работы/оказать услуги по ${contractType.toLowerCase()}: 
      <strong>${contract.subject}</strong>, а Заказчик обязуется принять и оплатить указанные работы/услуги.
    </p>
    <p>
      1.2. Срок выполнения работ/оказания услуг: до ${formatDate(contract.validUntil)}.
    </p>
  </div>

  <h2>2. СТОИМОСТЬ РАБОТ И ПОРЯДОК РАСЧЕТОВ</h2>
  <div class="section">
    <p>
      2.1. Стоимость работ/услуг по настоящему Договору составляет: 
      <span class="amount">${formatAmount(contract.amount, contract.amountNotSpecified)}</span>
      ${contract.vatAmount ? `, в том числе НДС ${contract.vatRate}%: ${formatAmount(contract.vatAmount, false)}` : ''}.
    </p>
    <p>
      2.2. Оплата производится в безналичном порядке путем перечисления денежных средств 
      на расчетный счет Исполнителя в течение 5 (пяти) банковских дней с момента подписания 
      Акта выполненных работ.
    </p>
  </div>

  <h2>3. ПРАВА И ОБЯЗАННОСТИ СТОРОН</h2>
  <div class="section">
    <p><strong>3.1. Заказчик обязуется:</strong></p>
    <p>3.1.1. Предоставить Исполнителю всю необходимую информацию и документацию для выполнения работ.</p>
    <p>3.1.2. Принять выполненные работы и подписать Акт выполненных работ в течение 5 рабочих дней.</p>
    <p>3.1.3. Оплатить выполненные работы в порядке и сроки, установленные настоящим Договором.</p>
    
    <p><strong>3.2. Исполнитель обязуется:</strong></p>
    <p>3.2.1. Выполнить работы качественно и в установленные сроки.</p>
    <p>3.2.2. Информировать Заказчика о ходе выполнения работ.</p>
    <p>3.2.3. Устранить выявленные недостатки за свой счет в разумные сроки.</p>
  </div>

  <h2>4. ОТВЕТСТВЕННОСТЬ СТОРОН</h2>
  <div class="section">
    <p>
      4.1. За неисполнение или ненадлежащее исполнение обязательств по настоящему Договору 
      Стороны несут ответственность в соответствии с действующим законодательством РФ.
    </p>
    <p>
      4.2. В случае нарушения сроков оплаты Заказчик уплачивает Исполнителю пени в размере 
      0,1% от суммы задолженности за каждый день просрочки.
    </p>
  </div>

  <h2>5. СРОК ДЕЙСТВИЯ ДОГОВОРА</h2>
  <div class="section">
    <p>
      5.1. Настоящий Договор вступает в силу с момента его подписания обеими Сторонами 
      и действует до ${formatDate(contract.validUntil)}.
    </p>
    ${contract.prolongation ? `
    <p>
      5.2. Договор считается пролонгированным на каждый последующий календарный год, 
      если ни одна из Сторон не заявит о его расторжении за 30 дней до окончания срока действия.
    </p>
    ` : ''}
  </div>

  <h2>6. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ</h2>
  <div class="section">
    <p>
      6.1. Все споры и разногласия решаются путем переговоров. При недостижении согласия 
      спор передается на рассмотрение в Арбитражный суд г. Москвы.
    </p>
    <p>
      6.2. Настоящий Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу, 
      по одному для каждой из Сторон.
    </p>
  </div>

  <h2>7. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН</h2>
  <div class="signatures">
    <div class="signature-block">
      <h3>ЗАКАЗЧИК:</h3>
      <p>${customerName}</p>
      ${counterparty.address ? `<p>Адрес: г. Москва</p>` : ''}
      <div class="signature-line"></div>
      <p class="signature-name">Директор / ________________</p>
      <p style="margin-top: 10px;">М.П.</p>
    </div>
    <div class="signature-block">
      <h3>ИСПОЛНИТЕЛЬ:</h3>
      <p>${counterparty.name}</p>
      <p>ИНН: ${counterparty.inn}</p>
      ${counterparty.address ? `<p>Адрес: ${counterparty.address}</p>` : ''}
      <div class="signature-line"></div>
      <p class="signature-name">${counterparty.directorName || 'Директор'} / ________________</p>
      <p style="margin-top: 10px;">М.П.</p>
    </div>
  </div>
</body>
</html>
`;
}

// HTML template for work completion act
export function generateActHtml(
  contract: Contract,
  counterparty: Counterparty,
  customerName: string = 'ООО "Рога и копыта"'
): string {
  const formatDate = (date: Date | string | null) => {
    if (!date) return "___________";
    return format(new Date(date), "dd MMMM yyyy", { locale: ru });
  };

  const formatAmount = (amount: string | null, notSpecified: boolean) => {
    if (notSpecified) return "По согласованию сторон";
    if (!amount) return "___________";
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 2,
    }).format(parseFloat(amount));
  };

  const actNumber = `АКТ-${contract.contractNumber}`;
  const actDate = format(new Date(), "dd MMMM yyyy", { locale: ru });

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Акт ${actNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14px;
      line-height: 1.6;
      color: #000;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 30px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .parties {
      margin-bottom: 20px;
      text-align: justify;
    }
    .content {
      margin-bottom: 20px;
    }
    .content p {
      text-indent: 30px;
      text-align: justify;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    table td, table th {
      border: 1px solid #000;
      padding: 10px;
      text-align: left;
    }
    table th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .total {
      text-align: right;
      font-weight: bold;
      margin: 20px 0;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 50px;
    }
    .signature-block {
      width: 45%;
    }
    .signature-block h3 {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      margin: 30px 0 5px;
      min-height: 20px;
    }
    .signature-name {
      font-size: 12px;
    }
    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <h1>АКТ № ${actNumber}<br>выполненных работ (оказанных услуг)</h1>
  
  <div class="header">
    <span>г. Москва</span>
    <span>${actDate}</span>
  </div>

  <div class="parties">
    <p>
      <strong>${customerName}</strong>, именуемое в дальнейшем «Заказчик», в лице Директора, 
      действующего на основании Устава, с одной стороны, и 
      <strong>${counterparty.name}</strong>, ИНН ${counterparty.inn}, 
      именуемое в дальнейшем «Исполнитель», в лице ${counterparty.directorName || 'Директора'}, 
      действующего на основании Устава, с другой стороны, 
      составили настоящий Акт о нижеследующем:
    </p>
  </div>

  <div class="content">
    <p>
      В соответствии с Договором № ${contract.contractNumber} от ${formatDate(contract.contractDate)} 
      Исполнитель выполнил, а Заказчик принял следующие работы/услуги:
    </p>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50px;">№</th>
        <th>Наименование работ/услуг</th>
        <th style="width: 150px;">Стоимость</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>${contract.subject}</td>
        <td>${formatAmount(contract.amount, contract.amountNotSpecified)}</td>
      </tr>
    </tbody>
  </table>

  <div class="total">
    <p>ИТОГО: ${formatAmount(contract.amount, contract.amountNotSpecified)}</p>
    ${contract.vatAmount ? `<p>В том числе НДС ${contract.vatRate}%: ${formatAmount(contract.vatAmount, false)}</p>` : ''}
  </div>

  <div class="content">
    <p>
      Вышеперечисленные работы/услуги выполнены полностью и в срок. 
      Заказчик претензий по объему, качеству и срокам выполнения работ/оказания услуг не имеет.
    </p>
    <p>
      Настоящий Акт составлен в двух экземплярах, имеющих одинаковую юридическую силу, 
      по одному для каждой из Сторон.
    </p>
  </div>

  <div class="signatures">
    <div class="signature-block">
      <h3>ЗАКАЗЧИК:</h3>
      <p>${customerName}</p>
      <div class="signature-line"></div>
      <p class="signature-name">Директор / ________________</p>
      <p style="margin-top: 10px;">М.П.</p>
    </div>
    <div class="signature-block">
      <h3>ИСПОЛНИТЕЛЬ:</h3>
      <p>${counterparty.name}</p>
      <div class="signature-line"></div>
      <p class="signature-name">${counterparty.directorName || 'Директор'} / ________________</p>
      <p style="margin-top: 10px;">М.П.</p>
    </div>
  </div>
</body>
</html>
`;
}
