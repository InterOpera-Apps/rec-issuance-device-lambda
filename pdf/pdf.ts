import fs from 'fs'
import numeral from 'numeral'
import PDFDocument from 'pdfkit'

export const DETAILS_TOP = 175
export const INVOICE_TABLE_TOP = 310
export const SUMMARY_INFO_TOP = 470

export const DEFAULT_SPACING = 15
export const SECTION_SPACING = 40
export const MARGIN_NARROW = 50
export const HEADER_Y = 130
export const MARGIN_BOTTOM = 100
export const A4_HEIGHT = 841.89
export const A4_WIDTH = 595.28
export const A4_WIDTH_MID = A4_WIDTH / 2
export const MAX_X = A4_WIDTH - MARGIN_NARROW
export const MAX_Y = A4_HEIGHT - MARGIN_NARROW
export const DATE_FORMAT = 'D MMM YYYY'
export const DEFAULT_FONT = 'Lato'
export const BOLD_FONT = 'Lato-Bold'
export const DEFAULT_FONT_SIZE = 10
export const SMALL_FONT_SIZE = 8
export const DEFAULT_COLOR = '#444444'

export function generatePdfTemplate(title: string) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN_NARROW
  })

  const logoImage = fs.readFileSync('static/images/interopera.png')
  downloadFontPackages(doc)
  generateHeader(doc, logoImage)
  generateHr(doc, 130)
  generateTitle(doc, 140, title)
  generateHr(doc, 170)
  return doc
}

function downloadFontPackages(doc) {
  doc.registerFont(DEFAULT_FONT, 'static/fonts/Lato-Regular.ttf')
  doc.registerFont(BOLD_FONT, 'static/fonts/Lato-Bold.ttf')
}

function generateHeader(doc, logoImage) {
  doc
    .font(DEFAULT_FONT)
    .fontSize(DEFAULT_FONT_SIZE)
    .image(logoImage, MARGIN_NARROW, 55, { height: 40 })
    .fillColor(DEFAULT_COLOR)
    .text('InterOpera Pte. Ltd.', 200, 55, { align: 'right' })
    .text('79 Anson Road, #06-05', 200, 70, { align: 'right' })
    .text('Singapore 079903', 200, 85, { align: 'right' })
    .text('UEN No.: 202115516D', 200, 100, { align: 'right' })
    // .text('GST Reg No.: <TO BE CONFIRMED>', 200, 115, { align: 'right' })
    .moveDown()
}

export function generateHr(doc, y, width?) {
  doc
    .strokeColor('#aaaaaa')
    .lineWidth(width ?? 1)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke()
}

function generateTitle(doc, y, title) {
  doc
    .fontSize(16)
    .text(title, 50, y, { align: 'left' })
    .moveDown()
}

export function formatCurrencyAmountTo2DpWithUnitAndComma(amount: number, unit?: string): string {
  const format = '0,0.00'
  const formattedAmt: string = numeral(amount).format(format)

  if (!unit) return formattedAmt

  return `${formattedAmt} ${unit}`
}

export function formatNumberUpTo6DpWithUnitAndComma(amount: number, unit?: string): string {
  const format = '0,0.[000000]'
  const formattedAmt: string = numeral(amount).format(format)

  if (!unit) return formattedAmt
  
  return `${formattedAmt} ${unit}`
}