import getStream from 'get-stream'
import moment from 'moment'
import {
  DETAILS_TOP, INVOICE_TABLE_TOP, SUMMARY_INFO_TOP, DEFAULT_SPACING, A4_WIDTH, A4_WIDTH_MID, MAX_X, BOLD_FONT,
  DATE_FORMAT, DEFAULT_FONT, DEFAULT_FONT_SIZE, DEFAULT_COLOR, formatCurrencyAmountTo2DpWithUnitAndComma, formatNumberUpTo6DpWithUnitAndComma,
  generateHr, generatePdfTemplate, MARGIN_NARROW,
} from './pdf/pdf.ts'
import { uploadToS3 } from './s3/s3.ts'

export interface InvoiceParam {
  issuanceTxId: string
  companyName: string
  // address: string
  // postalCode: string
  // city: string
  // country: string

  deviceName: string
  quantity: number
  issuer: string
  startDate: string
  endDate: string

  unitPrice: number
  totalExclTax: number
  currencyCode: string

  tax: number
  discountPct: number
  discount: number
  grandTotal: number
}

const invoiceParams = {
  issuanceTxId: 'a',
  companyName: 'Lim Jia Hao',
  // address: '69420000 0wefgwergergh wgesgerh er hrt hrthrthrdfergeg',
  // postalCode: '123456',
  // city: 'NEW YORKKK',
  // country: 'usaaaa',

  deviceName: 'Test asset',
  quantity: 50000.1234,
  issuer: 'test issuer',
  startDate: '17 Nov 2019',
  endDate: '16 Nov 2024',

  unitPrice: 1,
  totalExclTax: 1000.237,
  currencyCode: 'SGD',

  tax: 0,
  discountPct: 5.234,
  discount: 0,
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
    const { issuanceTxId } = invoiceInfo
    const doc = generatePdfTemplate('Payment Invoice')
    generateDetails(doc, invoiceInfo)
    generateInvoiceTable(doc, invoiceInfo)
    generateSummaryInfo(doc, invoiceInfo)
    doc.end()
    const buffer = await getStream.buffer(doc)

    const url = await uploadToS3(buffer, issuanceTxId)
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
  const { issuanceTxId, companyName } = invoiceInfo

  doc.font(DEFAULT_FONT).fontSize(DEFAULT_FONT_SIZE)

  let x = MARGIN_NARROW
  const y = DETAILS_TOP
  doc
    .text('Invoice Number:', x, y + DEFAULT_SPACING)
    .text('Date:', x, y + 2 * DEFAULT_SPACING)

  x += 100
  doc
    .text(issuanceTxId, x, y + DEFAULT_SPACING)
    .text(moment().format(DATE_FORMAT), x, y + 2 * DEFAULT_SPACING)

  x = A4_WIDTH_MID - 20
  doc
    .text('Company Name:', x, y + DEFAULT_SPACING)
    // .text('Address:', x, y + 2 * DEFAULT_SPACING)

  x += 80
  const maxWidthForName = MAX_X - x
  doc
    .text(companyName, x, y + DEFAULT_SPACING, { width: maxWidthForName, height: DEFAULT_SPACING, ellipsis: true })
    // .text(address, x, y + 2 * DEFAULT_SPACING, { width: maxWidthForName, height: DEFAULT_SPACING, ellipsis: true })
    // .text(postalCode, x, y + 3 * DEFAULT_SPACING, { width: maxWidthForName, height: DEFAULT_SPACING, ellipsis: true })
    // .text(city, x, y + 4 * DEFAULT_SPACING, { width: maxWidthForName, height: DEFAULT_SPACING, ellipsis: true })
    // .text(country, x, y + 5 * DEFAULT_SPACING, { width: maxWidthForName, height: DEFAULT_SPACING, ellipsis: true })
}

function generateInvoiceTable(doc, invoiceInfo: InvoiceParam) {
  const { currencyCode, deviceName, quantity, issuer, startDate, endDate, unitPrice, tax, totalExclTax } = invoiceInfo
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

  const quantityStr = formatNumberUpTo6DpWithUnitAndComma(quantity, "RECs")
  const issuanceInfo = ['REC Issuance', deviceName, quantityStr, issuer, `${startDate} - ${endDate}`]
  const taxValue = tax > 0 ? formatCurrencyAmountTo2DpWithUnitAndComma(tax) : 'No Tax'
    
  generateTableRow(
    doc,
    position,
    issuanceInfo,
    [formatNumberUpTo6DpWithUnitAndComma(quantity)],
    [formatCurrencyAmountTo2DpWithUnitAndComma(unitPrice)],
    [taxValue],
    [formatCurrencyAmountTo2DpWithUnitAndComma(totalExclTax)],
    false
  )

  position += (issuanceInfo.length + 1) * DEFAULT_SPACING
  generateHr(doc, position) 
}

function generateSummaryInfo(doc, invoiceInfo: InvoiceParam) {
  const { totalExclTax, tax, discountPct, discount, grandTotal, currencyCode } = invoiceInfo

  let position = SUMMARY_INFO_TOP
  const SUMMARY_ROW_SPACING = 20

  const summaryInfo = {
    'Total (Excl. Tax)': formatCurrencyAmountTo2DpWithUnitAndComma(totalExclTax, currencyCode),
    'Tax': formatCurrencyAmountTo2DpWithUnitAndComma(tax, currencyCode),
  }
  
  if (discount > 0) {
    const discountLabel = `Discount (${formatNumberUpTo6DpWithUnitAndComma(discountPct)}%)`
    summaryInfo[discountLabel] = formatCurrencyAmountTo2DpWithUnitAndComma(discount, currencyCode)
  }
  
  summaryInfo['Grand Total'] = formatCurrencyAmountTo2DpWithUnitAndComma(grandTotal, currencyCode)

  for (const label in summaryInfo) {
    const value = summaryInfo[label]

    generateSummaryRow(doc, position, label, value)
    position += SUMMARY_ROW_SPACING
  }

  generateSummaryRow(doc, position, 'Payment Method', 'Wallet')
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
