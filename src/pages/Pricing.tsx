import html from '../content/bang-gia.html?raw'
import '../styles/pricing.css'

/**
 * Trang bảng giá gửi trung tâm — nội dung lấy nguyên từ artifact "Bảng giá PTALK App"
 * (src/content/bang-gia.html), CSS scoped trong .pricing. URL: /#/bang-gia
 * Sửa nội dung: sửa thẳng file HTML trên.
 */
export function Pricing() {
  return <div className="pricing" dangerouslySetInnerHTML={{ __html: html }} />
}
