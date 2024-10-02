import getStream from 'get-stream'
import moment from 'moment'
import {
  DETAILS_TOP, INVOICE_TABLE_TOP, SUMMARY_INFO_TOP, DEFAULT_SPACING, A4_WIDTH, A4_WIDTH_MID, MAX_X, MAX_Y, BOLD_FONT,
  DATE_FORMAT, DEFAULT_FONT, DEFAULT_FONT_SIZE, DEFAULT_COLOR, formatCurrencyAmountTo2DpWithUnitAndComma, formatNumberUpTo6DpWithUnitAndComma,
  generateHr, generatePdfTemplate, MARGIN_NARROW,
} from './pdf/pdf.ts'
import { uploadToS3 } from './s3/s3.ts'

enum InvoiceType {
  "REC Issuance" = "REC-Issuance",
  "REC Redemption" = "REC-Redemption",
  "REC Withdrawal" = "REC-Withdrawal"
}

interface TxDetail {
  deviceName: string
  quantity: number
  issuer: string
  startDate: string
  endDate: string
  unitPrice: number
  totalExclTax: number
  tax: number
}

interface InvoiceParam {
  invoiceType: string
  txId: string
  companyName: string
  address: string

  details: TxDetail[]
  
  currencyCode: string
  totalExclTax: number
  discountPct: number
  discount: number
  tax: number
  grandTotal: number
}

const invoiceParams = {
  invoiceType: "REC Withdrawal",
  txId: 'a',
  companyName: 'Lim Jia Hao',
  address: '69420000 0wefgwergergh wgesgerh er hrt hrthrthrdfergeg',

  details: [
    {
      deviceName: 'Test asset a',
      quantity: 50000.1234,
      issuer: 'test issuer',
      startDate: '17 Feb 2019',
      endDate: '16 Nov 2024',
      unitPrice: 1,
      totalExclTax: 1000.237,
      tax: 0,
    },
    {
      deviceName: 'Test asset b',
      quantity: 320.1234,
      issuer: 'test issuer',
      startDate: '17 Mar 2019',
      endDate: '16 Nov 2024',
      unitPrice: 1,
      totalExclTax: 204.237,
      tax: 0,
    }
  ],

  currencyCode: 'SGD',
  totalExclTax: 1000.237,
  discountPct: 5.234,
  discount: 0,
  tax: 0,
  grandTotal: 123456969696.6923
}

interface Response {
  data?: string
  url?: string
  err?: string
}

export async function generateInvoice(invoiceInfo: InvoiceParam) {
  const resp: Response = {}
  try {
    const { txId, invoiceType } = invoiceInfo
    
    if (!Object.keys(InvoiceType).includes(invoiceType as InvoiceType)) {
      throw new Error("invalid invoice type received")
    }

    const doc = generatePdfTemplate('Payment Invoice')
    generateDetails(doc, invoiceInfo)
    const invoiceTablePositionEnd = generateInvoiceTable(doc, invoiceInfo)
    generateSummaryInfo(doc, invoiceInfo, invoiceTablePositionEnd)
    doc.end()
    const buffer = await getStream.buffer(doc)

    const fileNamePrefix = InvoiceType[invoiceType as keyof typeof InvoiceType]
    const filename =  `${fileNamePrefix}-Invoice-${txId}-${Date.now()}.pdf`

    const url = await uploadToS3(buffer, filename)
    resp.data = buffer.toString('base64')
    resp.url = url
  } catch (err) {
    console.error(err)
    if (err instanceof Error) resp.err = err.message
    else resp.err = String(err)
  }
  return resp
}

function generateDetails(doc, invoiceInfo: InvoiceParam) {
  const { txId, companyName, address } = invoiceInfo

  doc.font(DEFAULT_FONT).fontSize(DEFAULT_FONT_SIZE)

  let x = MARGIN_NARROW
  const y = DETAILS_TOP
  doc
    .text('Invoice Number:', x, y + DEFAULT_SPACING)
    .text('Date:', x, y + 2 * DEFAULT_SPACING)

  x += 100
  doc
    .text(txId, x, y + DEFAULT_SPACING)
    .text(moment().format(DATE_FORMAT), x, y + 2 * DEFAULT_SPACING)

  x = A4_WIDTH_MID - 20
  doc
    .text('Company Name:', x, y + DEFAULT_SPACING)
    .text('Address:', x, y + 2 * DEFAULT_SPACING)

  x += 80
  const maxWidthForName = MAX_X - x
  doc
    .text(companyName, x, y + DEFAULT_SPACING, { width: maxWidthForName, height: DEFAULT_SPACING, ellipsis: true })
    .text(address, x, y + 2 * DEFAULT_SPACING, { width: maxWidthForName })
}

function generateInvoiceTable(doc, invoiceInfo: InvoiceParam): number {
  const { invoiceType, currencyCode, details } = invoiceInfo
  let position = INVOICE_TABLE_TOP

  generateTableRow(
    doc,
    position,
    ['Description'],
    ['Quantity', 'MWh'],
    ['Unit Price', currencyCode],
    ['Tax'],
    ['Total (Excl. Tax)', currencyCode],
    true
  )
  position += 2 * DEFAULT_SPACING
  generateHr(doc, position)
  
  position += DEFAULT_SPACING

  for (let detail of details) {
    const { deviceName, quantity, issuer, startDate, endDate, unitPrice, tax, totalExclTax } = detail
    const quantityStr = formatNumberUpTo6DpWithUnitAndComma(quantity, "RECs")
    const info = [invoiceType, deviceName, quantityStr, issuer, `${startDate} - ${endDate}`]
    const taxValue = tax > 0 ? formatCurrencyAmountTo2DpWithUnitAndComma(tax) : 'No Tax'

    const endPosition = position + (info.length - 1) * DEFAULT_SPACING // end position of current detail block
    if (endPosition > MAX_Y) {
      position = MARGIN_NARROW
      doc.addPage()
    }
    
    generateTableRow(
    doc,
    position,
    info,
    [formatNumberUpTo6DpWithUnitAndComma(quantity)],
    [formatCurrencyAmountTo2DpWithUnitAndComma(unitPrice)],
    [taxValue],
    [formatCurrencyAmountTo2DpWithUnitAndComma(totalExclTax)],
    false
    )
    
    position += (info.length + 1) * DEFAULT_SPACING // new position of subsequent detail block
    if (position > MAX_Y) {
      position = MARGIN_NARROW
      doc.addPage()
    }
  }

  generateHr(doc, position)
  return position
}

function generateSummaryInfo(doc, invoiceInfo: InvoiceParam, position: number) {
  const { totalExclTax, tax, discountPct, discount, grandTotal, currencyCode } = invoiceInfo

  const summaryInfo = {}
  summaryInfo['Total (Excl. Tax)'] = formatCurrencyAmountTo2DpWithUnitAndComma(totalExclTax, currencyCode)
  
  if (discount > 0) {
    const discountLabel = `Discount (${formatNumberUpTo6DpWithUnitAndComma(discountPct)}%)`
    summaryInfo[discountLabel] = formatCurrencyAmountTo2DpWithUnitAndComma(discount, currencyCode)
  }
  
  summaryInfo['Tax'] = formatCurrencyAmountTo2DpWithUnitAndComma(tax, currencyCode)
  summaryInfo['Grand Total'] = formatCurrencyAmountTo2DpWithUnitAndComma(grandTotal, currencyCode)
  summaryInfo['Payment Method'] = 'Wallet'
  
  const SUMMARY_ROW_SPACING = 20
  for (const label in summaryInfo) {
    const value = summaryInfo[label]

    position += SUMMARY_ROW_SPACING
    if (position + DEFAULT_SPACING > MAX_Y) {
      position = MARGIN_NARROW
      doc.addPage()
    }

    generateSummaryRow(doc, position, label, value)
  }
}

function generateTableRow(doc, y: number, description: string[], quantity: string[], unitPrice: string[], tax: string[], total: string[], isHeader: boolean) {
  const NUM_COLS = 5
  const totalTableWidth = A4_WIDTH - 2 * MARGIN_NARROW

  const oneThirdWidth = totalTableWidth / 3
  const subsequentWidth = (totalTableWidth - oneThirdWidth) / (NUM_COLS - 1)

  doc.fontSize(DEFAULT_FONT_SIZE)

  const setFontStylesForHeader = (row: number) => {
    if (row === 0) doc.font(BOLD_FONT).fillColor(DEFAULT_COLOR)
    else doc.font(DEFAULT_FONT).fillColor('#919DB6')
  }

  const setFontStylesForDescriptionColumn = (row: number) => {
    if (row === 0) {
      doc.font(BOLD_FONT)
      doc.fillColor(DEFAULT_COLOR)
      doc.fontSize(11)
    } else {
      doc.font(DEFAULT_FONT)
      doc.fillColor('#53627E')
      doc.fontSize(DEFAULT_FONT_SIZE)
    }
  }

  const setDefaultFontStyle = () => {
    doc.font(DEFAULT_FONT).fontSize(DEFAULT_FONT_SIZE).fillColor(DEFAULT_COLOR)
  }

  for (const [i, value] of description.entries()) {
    if (isHeader) setFontStylesForHeader(i)
    else setFontStylesForDescriptionColumn(i)

    const yPos = y + i * DEFAULT_SPACING
    doc.text(value, MARGIN_NARROW, yPos, { width: oneThirdWidth, height: DEFAULT_SPACING, ellipsis: true })
  }

  for (const [i, value] of quantity.entries()) {
    if (isHeader) setFontStylesForHeader(i)
    else setDefaultFontStyle()
    
    const yPos = y + i * DEFAULT_SPACING
    const xPos = MARGIN_NARROW + oneThirdWidth
    doc.text(value, xPos, yPos, { width: subsequentWidth - 2, align: 'right' })
  }
  
  for (const [i, value] of unitPrice.entries()) {
    if (isHeader) setFontStylesForHeader(i)
    else setDefaultFontStyle()
    
    const yPos = y + i * DEFAULT_SPACING
    const xPos = MARGIN_NARROW + oneThirdWidth + subsequentWidth
    doc.text(value, xPos, yPos, { width: subsequentWidth - 2, align: 'right' })
  }
  
  for (const [i, value] of tax.entries()) {
    if (isHeader) setFontStylesForHeader(i)
    else setDefaultFontStyle()
    
    const yPos = y + i * DEFAULT_SPACING
    const xPos = MARGIN_NARROW + oneThirdWidth + 2 * subsequentWidth
    doc.text(value, xPos, yPos, { width: subsequentWidth - 2, align: 'right' })
  }
  
  for (const [i, value] of total.entries()) {
    if (isHeader) setFontStylesForHeader(i)
    else setDefaultFontStyle()
    
    const yPos = y + i * DEFAULT_SPACING
    const xPos = MARGIN_NARROW + oneThirdWidth + 3 * subsequentWidth
    doc.text(value, xPos, yPos, { width: subsequentWidth - 2, align: 'right' })
  }
}

function generateSummaryRow(doc, y: number, label: string, text: string) {
  if (label === 'Grand Total') doc.font(BOLD_FONT)
  else doc.font(DEFAULT_FONT)

  doc
    .fontSize(DEFAULT_FONT_SIZE)
    .text(label, A4_WIDTH_MID - 100, y, { width: 180, align: 'right' })
    .text(text, 0, y, { align: 'right' })
}
