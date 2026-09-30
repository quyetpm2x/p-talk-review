import { useState, type FormEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import '../styles/landing.css'

/**
 * Landing page PTalk English — chuyển từ 2 mockup thiết kế (Desktop 1280 · 1 & 2) thành một trang.
 * Nằm ngoài khung app (không giới hạn 480px), không qua màn nhập tên. URL: /#/landing
 */

const A = '/landing' // thư mục ảnh minh hoạ trong public/
const PHONE = '0815966886'
const MAPS = 'https://www.google.com/maps/search/?api=1&query=41+ngo+68+Trung+Kinh+Ha+Noi'

/** Cuộn tới mục trong trang (không đổi hash của HashRouter). */
const go = (id: string) => (e: MouseEvent) => {
  e.preventDefault()
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

const Ico = ({ n, className = 'ico' }: { n: string; className?: string }) => (
  <svg className={className} aria-hidden><use href={`#i-${n}`} /></svg>
)
const Tk = () => <span className="tk"><Ico n="check" /></span>

/** Bộ icon (đường nét, tô bằng currentColor) — dùng qua <use href="#i-…"> */
function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></symbol>
      <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
      <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></symbol>
      <symbol id="i-device" viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></symbol>
      <symbol id="i-grad" viewBox="0 0 24 24"><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6" /></symbol>
      <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></symbol>
      <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
      <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z" /></symbol>
      <symbol id="i-brief" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2M3 12.5h18" /></symbol>
      <symbol id="i-lamp" viewBox="0 0 24 24"><path d="M8 3h8l3 8H5z" /><path d="M12 11v7M8 21h8" /></symbol>
      <symbol id="i-game" viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="11" rx="5.5" /><path d="M7 11v3M5.5 12.5h3" /><circle cx="15.5" cy="11.5" r="1" /><circle cx="17.5" cy="13.5" r="1" /></symbol>
      <symbol id="i-film" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5v5l4.5-2.5z" /></symbol>
      <symbol id="i-mic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></symbol>
      <symbol id="i-wave" viewBox="0 0 24 24"><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2" /></symbol>
      <symbol id="i-phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></symbol>
      <symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5L12 13l8.5-6.5" /></symbol>
      <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
      <symbol id="i-gauge" viewBox="0 0 24 24"><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></symbol>
      <symbol id="i-chat" viewBox="0 0 24 24"><path d="M12 3.5c-4.9 0-8.5 3.4-8.5 7.8 0 2.4 1.1 4.5 2.9 6V21l3.2-1.8c.8.2 1.6.3 2.4.3 4.9 0 8.5-3.4 8.5-7.8S16.9 3.5 12 3.5z" /><path d="M7.5 13l3-3 2.5 2 3.5-3" /></symbol>
      <symbol id="i-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
    </svg>
  )
}

const NAV = [
  ['khac-biet', 'Khác biệt'], ['phuong-phap', 'Phương pháp'], ['khoa-hoc', 'Khoá học'], ['hoc-vien', 'Học viên'], ['lien-he', 'Liên hệ'],
] as const

const TEACHERS = [1, 2, 3, 4]
const QUOTES = [
  { i: 'PA', name: 'Vũ Phương Anh', job: 'Nhân viên văn phòng', text: 'Điều mình thích nhất ở PTalk là giáo viên rất sát với học viên. Chỗ nào chưa hiểu đều được giải thích lại rất kỹ, không tạo cảm giác áp lực.' },
  { i: 'NH', name: 'Nguyễn Ngọc Huyền', job: 'Kế toán trưởng', text: 'Ban đầu mình khá ngại giao tiếp tiếng Anh vì sợ nói sai, nhưng sau một thời gian học ở PTalk mình tự tin hơn nhiều.' },
  { i: 'PM', name: 'Bùi Phương Mai', job: 'Quản lý', text: 'Tôi đánh giá cao sự chuyên nghiệp và nhiệt tình của đội ngũ PTalk. Từ giáo viên đến các bạn nhân viên đều rất thân thiện.' },
  { i: 'TT', name: 'Lê Thu Thảo', job: 'Trưởng phòng Kinh doanh', text: 'Mình học ở PTalk được một thời gian và rất ưng môi trường ở đây. Giáo viên nhiệt tình, dễ gần, giảng bài dễ hiểu.' },
]

export function Landing() {
  const [menu, setMenu] = useState(false)
  const [sent, setSent] = useState(false)
  const nav = (id: string) => (e: MouseEvent) => { setMenu(false); go(id)(e) }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = e.currentTarget
    const name = f.elements.namedItem('name') as HTMLInputElement
    const phone = f.elements.namedItem('phone') as HTMLInputElement
    if (!name.value.trim()) return name.focus()
    if (!/^\d[\d .]{7,}$/.test(phone.value.trim())) return phone.focus()
    setSent(true)
  }

  return (
    <div className="pt" id="top">
      <Sprite />

      <header className="hdr">
        <div className="wrap hdr-in">
          <a className="logo" href="#top" onClick={go('top')} aria-label="PTalk English"><b>PTALK</b><small>ENGLISH</small></a>
          <nav className={`nav ${menu ? 'open' : ''}`} aria-label="Điều hướng chính">
            {NAV.map(([id, label]) => <a key={id} href={`#${id}`} onClick={nav(id)}>{label}</a>)}
          </nav>
          <div className="hdr-cta">
            <a className="lp-btn lp-btn-gold" href="#dang-ky" onClick={nav('dang-ky')}>Học thử miễn phí</a>
            <button className="menu-btn" type="button" aria-label={menu ? 'Đóng menu' : 'Mở menu'} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <Ico n={menu ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Speak with mastery, own your destiny</p>
            <h1>Nói tiếng Anh tự tin trong <em>12 tuần</em>, không học lại từ đầu</h1>
            <p className="desc">Lớp 7–12 người, giáo viên bản ngữ và phương pháp ARS dành riêng cho người đi làm. Bạn luyện đúng những tình huống gặp mỗi ngày: họp, thuyết trình, trao đổi với đối tác và khách hàng.</p>
            <div className="hero-ctas">
              <a className="lp-btn lp-btn-gold" href="#dang-ky" onClick={go('dang-ky')}>Đăng ký học thử <Ico n="arrow" /></a>
              <a className="lp-btn lp-btn-ghost" href="#khoa-hoc" onClick={go('khoa-hoc')}>Xem lộ trình</a>
            </div>
            <p className="hero-note">Miễn phí, có test trình độ 15 phút.</p>
            <div className="lp-stats">
              <div className="lp-stat"><b>2020</b><span>Năm thành lập</span></div>
              <div className="lp-stat"><b>7–12</b><span>Học viên mỗi lớp</span></div>
              <div className="lp-stat"><b>3</b><span>Cấp độ lộ trình</span></div>
            </div>
          </div>
          <div className="hero-media">
            <figure className="ph"><img src={`${A}/hero-class.svg`} alt="Minh hoạ lớp học PTalk: giáo viên bản ngữ trò chuyện với nhóm học viên" /></figure>
            <div className="lp-chip"><i aria-hidden /><span><b>Level 2 · Fluent</b><small>Lớp đang học tại Trung Kính</small></span></div>
          </div>
        </div>
      </section>

      <section className="sec" id="khac-biet">
        <div className="wrap">
          <div className="diff-head">
            <p className="kicker">Vì sao chọn PTalk</p>
            <h2 className="h2">Điểm khác biệt tại <em className="hl">PTalk English</em></h2>
            <p className="lead">Người đi làm không thiếu kiến thức ngữ pháp. Cái thiếu là môi trường để nói thật, được sửa ngay và luyện đều. PTalk được xây quanh đúng điều đó.</p>
          </div>
          <div className="bento">
            <article className="bt bt-navy">
              <p className="bt-tag">01 · Lớp nhỏ</p>
              <div className="bt-big">7–12</div>
              <p className="bt-unit">học viên mỗi lớp</p>
              <h3>Sĩ số lớp học nhỏ từ <span className="nw">7–12</span> học viên</h3>
              <p>Mỗi buổi bạn đều được gọi tên, được nói và được sửa lỗi. Không ngồi nghe cả buổi ở cuối lớp.</p>
            </article>
            <article className="bt bt-wide bt-split">
              <figure className="bt-media"><img src={`${A}/space.svg`} alt="Minh hoạ không gian PTalk hiện đại, sang trọng" /></figure>
              <div>
                <p className="bt-tag">02 · Không gian học</p>
                <h3>Mô hình lớp học theo phong cách hiện đại, sang trọng, khơi nguồn cảm hứng</h3>
                <p>Không gian chỉn chu, cơ sở vật chất 5 sao tại Trung Kính, kèm hoạt động ngoại khoá để dùng tiếng Anh ngoài giờ học.</p>
              </div>
            </article>
            <article className="bt bt-wide">
              <p className="bt-tag">03 · Phương pháp</p>
              <h3>Phương pháp học tập ARS</h3>
              <p>Lộ trình ba bước từ hiểu, phản xạ đến duy trì, được xây từ nghiên cứu đào tạo ngoại ngữ.</p>
              <div className="ars-mini"><span><b>A</b><small>Acquire</small></span><span><b>R</b><small>Reflex</small></span><span><b>S</b><small>Sustain</small></span></div>
              <a className="bt-link" href="#phuong-phap" onClick={go('phuong-phap')}>Xem phương pháp <Ico n="arrow" /></a>
            </article>
            <article className="bt bt-navy">
              <p className="bt-tag">04 · Giảng viên</p>
              <div className="avs">
                {TEACHERS.map((n) => <img key={n} src={`${A}/teacher-${n}.svg`} alt="" />)}
                <span>Bản ngữ</span>
              </div>
              <h3>Đội ngũ giáo viên bản ngữ</h3>
              <p>Nghe giọng thật, phản xạ ở tốc độ thật. Phát âm và ngữ điệu được chỉnh trực tiếp trong giờ học.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="sec sec-band" id="mo-hinh">
        <div className="wrap model">
          <div className="model-media">
            <figure className="ph ph-light"><img src={`${A}/room.svg`} alt="Minh hoạ phòng học PTalk: bàn chữ U, màn hình lớn, ánh sáng ấm" /></figure>
            <div className="model-badge"><Ico n="star" />Tiêu chuẩn 5 sao</div>
          </div>
          <div>
            <p className="kicker">Mô hình đào tạo</p>
            <h2 className="h2">Tiếng Anh giao tiếp chuyên nghiệp. <em className="hl">Lớp nhỏ, tiêu chuẩn 5 sao.</em></h2>
            <ul className="model-list">
              <li><span className="mi"><Ico n="users" /></span><div><b>Lớp nhỏ <span className="nw">7–12</span> học viên</b><span>Giáo viên theo sát từng người. Ai cũng có lượt nói và được sửa lỗi ngay trong buổi.</span></div></li>
              <li><span className="mi"><Ico n="lamp" /></span><div><b>Không gian hiện đại, sang trọng</b><span>Phòng học được thiết kế để bạn thoải mái mở lời và có cảm hứng học sau giờ làm.</span></div></li>
              <li><span className="mi"><Ico n="star" /></span><div><b>Cơ sở vật chất tiêu chuẩn 5 sao</b><span>Trang thiết bị hiện đại, phòng học chỉn chu tại Trung Kính.</span></div></li>
              <li><span className="mi"><Ico n="brief" /></span><div><b>Nội dung theo tình huống công việc</b><span>Họp, thuyết trình, trao đổi với đối tác và khách hàng: luyện đúng việc bạn làm mỗi ngày.</span></div></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="sec sec-navy" id="phuong-phap">
        <div className="wrap">
          <div className="ars-top">
            <div>
              <p className="kicker">Phương pháp học ARS</p>
              <h2 className="h2">Từ hiểu đến nói được, <em className="hl">theo đúng ba bước.</em></h2>
            </div>
            <p className="origin"><span className="origin-ico"><Ico n="grad" /></span><span>Người sáng lập PTalk có <b>hơn 6 năm nghiên cứu và thực hành đào tạo ngoại ngữ</b>, với nền tảng từ <b>Đại học Kinh tế Quốc dân</b>. ARS là cách PTalk đúc kết lại để người bận rộn vẫn tiến bộ đều.</span></p>
          </div>
          <ol className="ars3">
            <li className="ars-card" data-l="A"><div className="ars-head"><span className="ars-medal" aria-hidden>A</span><span className="ars-step">Bước 1</span></div><p className="ars-en">Acquire</p><h3>Nạp đúng từ gốc</h3><p className="ars-desc">Học âm, từ và mẫu câu theo tình huống công việc thật. Hiểu vì sao người bản xứ nói như vậy trước khi bạn nói.</p></li>
            <li className="ars-card" data-l="R"><div className="ars-head"><span className="ars-medal" aria-hidden>R</span><span className="ars-step">Bước 2</span></div><p className="ars-en">Reflex</p><h3>Luyện phản xạ trên lớp</h3><p className="ars-desc">Nói liên tục với giáo viên bản ngữ và bạn cùng lớp, cho đến khi câu trả lời bật ra mà không cần dịch trong đầu.</p></li>
            <li className="ars-card" data-l="S"><div className="ars-head"><span className="ars-medal" aria-hidden>S</span><span className="ars-step">Bước 3</span></div><p className="ars-en">Sustain</p><h3>Duy trì mỗi ngày</h3><p className="ars-desc">Ôn trên ứng dụng điện thoại của PTalk vài phút mỗi ngày để không quên sau giờ học.</p><span className="app-note"><Ico n="device" />26 trò chơi · phim tương tác</span></li>
          </ol>
          <div className="inclass">
            <p className="inclass-t">Trong mỗi buổi học</p>
            <ul className="inclass-l">
              <li>Đóng vai tình huống công việc</li>
              <li>Sửa phát âm, ngữ điệu cùng giáo viên bản ngữ</li>
              <li>Thảo luận nhóm nhỏ, ai cũng có lượt nói</li>
              <li>Ôn tiếp trên app sau giờ học</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="sec" id="ung-dung">
        <div className="wrap lp-app">
          <div className="app-media">
            <img src={`${A}/app-phone.svg`} alt="Minh hoạ màn hình PTalk App: trò chơi ghép từ và luyện nói" />
            <div className="app-chip c1"><b>26</b><span>trò chơi<br />ôn tập</span></div>
            <div className="app-chip c2"><Ico n="mic" /><span>Luyện phát âm<br />&amp; luyện nói</span></div>
          </div>
          <div>
            <p className="kicker">PTalk App</p>
            <h2 className="h2">Vừa học vừa chơi <em className="hl">với PTalk App.</em></h2>
            <p className="lead">Ôn luyện kiến thức, kỹ năng phát âm và luyện nói ngay trên điện thoại, nối tiếp những gì bạn học trên lớp.</p>
            <div className="feats">
              <article className="feat"><span className="mi"><Ico n="game" /></span><h3>26 trò chơi ôn tập</h3><p>Ôn từ vựng và mẫu câu vừa học qua những trò chơi ngắn.</p></article>
              <article className="feat"><span className="mi"><Ico n="film" /></span><h3>Phim tương tác</h3><p>Học qua các tình huống giao tiếp thực tế trong phim.</p></article>
              <article className="feat"><span className="mi"><Ico n="wave" /></span><h3>Luyện phát âm</h3><p>Nghe mẫu, nói theo để chỉnh âm và ngữ điệu.</p></article>
              <article className="feat"><span className="mi"><Ico n="mic" /></span><h3>Luyện nói</h3><p>Tập nói mọi lúc để tự tin mở lời khi vào lớp.</p></article>
            </div>
            <div className="store">
              <Link to="/"><Ico n="device" />Mở PTalk App trên web</Link>
              <a href="#ung-dung" onClick={go('ung-dung')}><Ico n="device" />[Link App Store]</a>
              <a href="#ung-dung" onClick={go('ung-dung')}><Ico n="device" />[Link Google Play]</a>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="giang-vien">
        <div className="wrap tlay">
          <div>
            <p className="kicker">Đội ngũ giảng viên</p>
            <h2 className="h2">Giáo viên bản ngữ, <em className="hl">theo sát từng học viên.</em></h2>
            <p className="lead">Lớp chỉ 7–12 người nên giáo viên biết tên, biết điểm mạnh và điểm cần sửa của từng bạn, rồi điều chỉnh bài giảng theo đó.</p>
            <ul className="tpoints">
              <li><Tk />Giáo viên bản ngữ, nghe giọng và tốc độ nói thật</li>
              <li><Tk />Sửa phát âm, ngữ điệu ngay trong giờ học</li>
              <li><Tk />Theo sát từng người trong lớp 7–12 học viên</li>
            </ul>
            <figure className="tquote">
              <blockquote>Giáo viên rất sát với học viên. Chỗ nào chưa hiểu đều được giải thích lại rất kỹ, không tạo cảm giác áp lực.</blockquote>
              <figcaption><cite>Vũ Phương Anh</cite> · Nhân viên văn phòng</figcaption>
            </figure>
          </div>
          <div className="tgrid">
            {TEACHERS.map((n) => (
              <figure className="tc2" key={n}>
                <img src={`${A}/teacher-${n}.svg`} alt="Minh hoạ chân dung giảng viên PTalk" />
                <span className="tc2-tag">Bản ngữ</span>
                <figcaption><b>[Tên giảng viên]</b><span>[Quốc tịch]</span><small>[Chứng chỉ] · [Số năm kinh nghiệm]</small></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="sec sec-band" id="khoa-hoc">
        <div className="wrap">
          <p className="kicker">Lộ trình 3 cấp độ</p>
          <h2 className="h2">Bắt đầu <em className="hl">đúng chỗ</em> của bạn.</h2>
          <p className="lead">Bài test 15 phút trong buổi học thử sẽ xếp bạn vào cấp độ phù hợp. Không học lại những gì bạn đã biết.</p>
          <div className="track" aria-hidden><span>Nền tảng</span><span>Trôi chảy</span><span>Chuyên ngành</span></div>
          <div className="levels2">
            <article className="lv2 lv2-a">
              <div className="lv2-head"><span className="lv2-num" aria-hidden>01</span><p className="lv2-tag">Level 1</p><h3>Builder</h3><p className="lv2-sub">Lấy lại nền tảng</p></div>
              <div className="lv2-body">
                <ul>
                  <li><Tk />Phát âm chuẩn với 44 âm IPA</li>
                  <li><Tk />Từ vựng công việc và đời sống</li>
                  <li><Tk />Xây lại nền tảng để nói câu hoàn chỉnh</li>
                </ul>
                <a className="lp-btn-line" href="#dang-ky" onClick={go('dang-ky')}>Học thử Level 1</a>
              </div>
            </article>
            <article className="lv2 lv2-b">
              <div className="lv2-head"><span className="lv2-num" aria-hidden>02</span><span className="lv2-badge">Được chọn nhiều nhất</span><p className="lv2-tag">Level 2</p><h3>Fluent</h3><p className="lv2-sub">Trôi chảy với người bản xứ</p></div>
              <div className="lv2-body">
                <ul>
                  <li><Tk />Ngữ điệu tự nhiên khi nói chuyện</li>
                  <li><Tk />Idiom và slang người bản xứ dùng thật</li>
                  <li><Tk />Thành thạo tiếng Anh trong công việc</li>
                </ul>
                <a className="lp-btn lp-btn-gold lp-btn-block" href="#dang-ky" onClick={go('dang-ky')}>Học thử Level 2</a>
              </div>
            </article>
            <article className="lv2 lv2-c">
              <div className="lv2-head"><span className="lv2-num" aria-hidden>03</span><p className="lv2-tag">Level 3</p><h3>Expert</h3><p className="lv2-sub">Tiếng Anh chuyên ngành</p></div>
              <div className="lv2-body">
                <ul>
                  <li><Tk />Kinh tế và thương mại</li>
                  <li><Tk />Dịch vụ khách hàng</li>
                  <li><Tk />Vận hành doanh nghiệp</li>
                </ul>
                <a className="lp-btn-line" href="#dang-ky" onClick={go('dang-ky')}>Học thử Level 3</a>
              </div>
            </article>
          </div>
          <div className="lp-soon">
            <div className="soon-item"><b>Online 1–1</b><span>Sắp ra mắt</span></div>
            <div className="soon-item"><b>Đào tạo doanh nghiệp</b><span>Sắp ra mắt</span></div>
          </div>
        </div>
      </section>

      <section className="sec sec-navy" id="ngoai-khoa">
        <div className="wrap">
          <p className="kicker">Hoạt động ngoại khoá</p>
          <h2 className="h2">Dùng tiếng Anh <em className="hl">ngoài giờ học.</em></h2>
          <p className="lead">Ngoại khoá là lúc bạn dùng những gì học trên lớp trong không khí thoải mái, gặp học viên các lớp khác và giáo viên bản ngữ.</p>
          <div className="acts">
            <figure className="act"><img src={`${A}/act-coffee.svg`} alt="Minh hoạ buổi trò chuyện tiếng Anh bên bàn cà phê" /><figcaption><b>[Tên hoạt động · VD: English Coffee Talk]</b><span>[Tần suất · địa điểm]</span></figcaption></figure>
            <figure className="act"><img src={`${A}/act-workshop.svg`} alt="Minh hoạ buổi workshop thuyết trình tiếng Anh" /><figcaption><b>[Tên hoạt động · VD: Workshop thuyết trình]</b><span>[Tần suất · địa điểm]</span></figcaption></figure>
            <figure className="act"><img src={`${A}/act-outdoor.svg`} alt="Minh hoạ buổi giao lưu ngoài trời của học viên" /><figcaption><b>[Tên hoạt động · VD: Giao lưu ngoài trời]</b><span>[Tần suất · địa điểm]</span></figcaption></figure>
          </div>
        </div>
      </section>

      <section className="sec" id="hoc-vien">
        <div className="wrap">
          <p className="kicker">Học viên nói gì</p>
          <h2 className="h2">Người đi làm như bạn, <em className="hl">sau vài tháng ở PTalk.</em></h2>
          <div className="quotes">
            {QUOTES.map((q) => (
              <figure className="q" key={q.i}>
                <blockquote>{q.text}</blockquote>
                <figcaption><span className="av" aria-hidden>{q.i}</span><span><cite>{q.name}</cite><small>{q.job}</small></span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="sec sec-navy" id="dang-ky">
        <div className="wrap reg">
          <div>
            <p className="kicker">Học thử miễn phí</p>
            <h2 className="h2">Học thử một buổi. <em className="hl">Quyết định sau.</em></h2>
            <ul className="benefits">
              <li><span className="bi"><Ico n="clock" /></span><div><b>Gọi lại trong 24 giờ</b><span className="btx">Tư vấn viên xếp lịch theo giờ làm của bạn.</span></div></li>
              <li><span className="bi"><Ico n="gauge" /></span><div><b>Test trình độ 15 phút</b><span className="btx">Biết chính xác bạn đang ở đâu và nên bắt đầu từ cấp độ nào.</span></div></li>
              <li><span className="bi"><Ico n="users" /></span><div><b>Học thử trong lớp thật</b><span className="btx">Ngồi cùng học viên, học với giáo viên bản ngữ. Không phải buổi demo.</span></div></li>
              <li><span className="bi"><Ico n="shield" /></span><div><b>Không phí ẩn</b><span className="btx">Học thử miễn phí. Học phí được báo rõ trước khi bạn quyết định.</span></div></li>
            </ul>
          </div>
          <div className="form-card">
            <form onSubmit={submit} noValidate>
              <div className="form-head">
                <span className="form-pill">Miễn phí</span>
                <h3>Đăng ký học thử</h3>
                <p className="fsub">Điền 2 thông tin bắt buộc, mất khoảng 30 giây.</p>
              </div>
              {sent ? (
                <div className="form-sent" role="status">
                  <b>Đã nhận đăng ký của bạn 🎉</b>
                  <p>PTalk sẽ gọi lại trong 24 giờ làm việc để xếp lịch học thử.</p>
                </div>
              ) : (
                <div className="form-body">
                  <div className="fields">
                    <div className="field"><label htmlFor="d-name">Họ và tên <i>*</i></label><input id="d-name" name="name" type="text" autoComplete="name" required /></div>
                    <div className="field"><label htmlFor="d-phone">Số điện thoại <i>*</i></label><input id="d-phone" name="phone" type="tel" autoComplete="tel" placeholder="VD: 0912 345 678" required /></div>
                    <div className="field"><label htmlFor="d-email">Email</label><input id="d-email" name="email" type="email" autoComplete="email" /></div>
                    <div className="field"><label htmlFor="d-level">Trình độ hiện tại</label>
                      <div className="lp-sel">
                        <select id="d-level" name="level" defaultValue="">
                          <option value="">Chọn trình độ</option>
                          <option>Mất gốc, cần lấy lại nền tảng</option>
                          <option>Giao tiếp cơ bản, còn ngập ngừng</option>
                          <option>Khá, muốn trôi chảy trong công việc</option>
                          <option>Cần tiếng Anh chuyên ngành</option>
                          <option>Chưa rõ, muốn được test</option>
                        </select>
                        <Ico n="down" />
                      </div>
                    </div>
                  </div>
                  <button className="lp-btn lp-btn-gold lp-btn-block" type="submit">Nhận tư vấn miễn phí</button>
                  <p className="privacy">Thông tin chỉ dùng để PTalk liên hệ tư vấn.</p>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      <section className="sec" id="lien-he">
        <div className="wrap">
          <div className="cbox">
            <div>
              <p className="kicker">Liên hệ</p>
              <h2 className="h2">Ghé PTalk ở <em className="hl">Trung Kính.</em></h2>
              <p className="cbox-lead">Gọi, nhắn Zalo hoặc ghé thẳng trung tâm. Tư vấn viên sẽ giúp bạn chọn lịch học thử phù hợp.</p>
              <ul className="ctiles">
                <li><a className="ctile" href={MAPS} target="_blank" rel="noopener"><span className="ci2"><Ico n="pin" /></span><span><small>Địa chỉ</small><b>Số 41 ngõ 68, Trung Kính, Hà Nội</b></span></a></li>
                <li><a className="ctile" href={`tel:${PHONE}`}><span className="ci2"><Ico n="phone" /></span><span><small>Hotline / Zalo</small><b>0815.96.6886</b></span></a></li>
                <li><a className="ctile" href="mailto:ceoptalkenglish@gmail.com"><span className="ci2"><Ico n="mail" /></span><span><small>Email</small><b>ceoptalkenglish@gmail.com</b></span></a></li>
              </ul>
              <div className="cbtns">
                <a className="lp-btn lp-btn-gold" href={`tel:${PHONE}`}><Ico n="phone" />Gọi ngay</a>
                <a className="lp-btn lp-btn-ghost" href={`https://zalo.me/${PHONE}`} target="_blank" rel="noopener"><Ico n="chat" />Chat Zalo</a>
                <a className="lp-btn lp-btn-ghost" href={MAPS} target="_blank" rel="noopener"><Ico n="pin" />Chỉ đường</a>
              </div>
            </div>
            <div className="cbox-media">
              <figure className="ph ph-light"><img src={`${A}/space.svg`} alt="Minh hoạ sảnh đón PTalk English tại Trung Kính" /></figure>
              <div className="pin-card"><span className="pin-dot"><Ico n="pin" /></span><span><b>PTalk English</b><small>Số 41 ngõ 68, Trung Kính</small></span></div>
            </div>
          </div>
        </div>
      </section>

      <footer className="ftr">
        <div className="wrap">
          <div className="ftr-top">
            <div className="ftr-brand">
              <a className="logo" href="#top" onClick={go('top')} aria-label="PTalk English – về đầu trang"><b>PTALK</b><small>ENGLISH</small></a>
              <p className="ftr-slogan">Speak with mastery, own your destiny</p>
              <p className="ftr-desc">Tiếng Anh giao tiếp cho người đi làm tại Hà Nội. Lớp 7–12 học viên, giáo viên bản ngữ, phương pháp ARS.</p>
              <a className="lp-btn lp-btn-gold ftr-cta" href="#dang-ky" onClick={go('dang-ky')}>Học thử miễn phí</a>
            </div>
            <nav className="ftr-col ftr-links" aria-label="Liên kết chân trang">
              <p className="ftr-h">Khám phá</p>
              {NAV.map(([id, label]) => <a key={id} href={`#${id}`} onClick={go(id)}>{label}</a>)}
              <Link to="/">PTalk App</Link>
            </nav>
            <div className="ftr-col">
              <p className="ftr-h">Liên hệ</p>
              <a href={MAPS} target="_blank" rel="noopener">Số 41 ngõ 68, Trung Kính, Hà Nội</a>
              <a href={`tel:${PHONE}`}>0815.96.6886</a>
              <a href="mailto:ceoptalkenglish@gmail.com">ceoptalkenglish@gmail.com</a>
              <div className="soc">
                <a href={`https://zalo.me/${PHONE}`} target="_blank" rel="noopener" aria-label="Zalo PTalk">Zalo</a>
                <a href="https://m.me/ptalkenglish" target="_blank" rel="noopener" aria-label="Messenger PTalk"><Ico n="chat" /></a>
              </div>
            </div>
          </div>
          <div className="ftr-bottom">
            <p>Công ty TNHH NCH Education · MST 0111489756</p>
            <p>© 2026 PTalk English</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
