<script setup lang="ts">
import { ref, computed } from 'vue';
import { useData } from '../stores/data';
import { summarize, summaryToAoa, WFH_BUCKET_LABELS } from '../domain/report/summary';
import { printElement } from './print';
import { aoaToXlsxBlob } from '../domain/transfer/xlsx';
import { downloadBlob } from './download';

const data = useData();

// Filter: year + term; default to current period
const year = ref(data.period.year || '2568');
const term = ref(data.period.term || '1');

// Dynamic year options: current period year ± 1
const yearOptions = computed(() => {
  const base = Number(data.period.year) || 2568;
  return [String(base + 1), String(base), String(base - 1)];
});

const summary = computed(() =>
  summarize(data.students, data.measures, year.value, term.value),
);

const WFH_CATEGORIES = WFH_BUCKET_LABELS.map((label, i) => ({
  key: i,
  label,
  cls: ['thin', 'lthin', 'norm', 'chubby', 'obese'][i],
}));

const catTotals = computed(() =>
  WFH_CATEGORIES.map((_, i) => summary.value.byGrade.reduce((s, g) => s + g.counts[i], 0)),
);
const tallTotal = computed(() => summary.value.tall);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

const CRITERIA = {
  source: 'สำนักโภชนาการ กรมอนามัย',
  version: 'เกณฑ์อ้างอิงการเจริญเติบโต พ.ศ. 2564',
};

// Today's date in Thai format
const today = computed(() => {
  const d = new Date();
  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const buddhistYear = d.getFullYear() + 543;
  return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${buddhistYear}`;
});

// Reference to the printable document
const documentEl = ref<HTMLElement | null>(null);

function handlePrint() {
  if (documentEl.value) {
    printElement(documentEl.value);
  }
}

function handleXlsx() {
  const blob = aoaToXlsxBlob(
    summaryToAoa(data.setup, summary.value, year.value, term.value),
    'สรุปโภชนาการ',
  );
  downloadBlob(blob, `รายงานสรุป ${year.value} ภาค${term.value}.xlsx`);
}
</script>

<template>
  <div class="container">
    <h1 class="page-title">รายงานสำหรับหน่วยงานต้นสังกัด</h1>
    <p class="page-sub">สรุปภาวะโภชนาการของทั้งโรงเรียนตามปีการศึกษาและภาคเรียน สำหรับพิมพ์เป็น PDF หรือส่งออกเป็นไฟล์ตาราง</p>

    <!-- filter: only year + term (BRD FR-8.1 filterable by academic year) -->
    <div class="filterbar">
      <div class="field">
        <label>ปีการศึกษา</label>
        <select v-model="year"><option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option></select>
      </div>
      <div class="field">
        <label>ภาคเรียน</label>
        <select v-model="term"><option value="1">ภาคเรียน 1</option><option value="2">ภาคเรียน 2</option></select>
      </div>
      <span class="spacer"></span>
      <button class="btn primary lg" @click="handlePrint">🖨️ พิมพ์ / บันทึก PDF</button>
      <button class="btn lg" @click="handleXlsx">📊 ส่งออก Excel</button>
    </div>

    <!-- document preview: this is what prints / exports -->
    <div ref="documentEl" class="doc">
      <div class="doc-head">
        <div>
          <div class="doc-title">รายงานสรุปภาวะโภชนาการนักเรียน</div>
          <div class="doc-school">{{ data.setup.school }} · จังหวัด{{ data.setup.province }}</div>
        </div>
        <div class="doc-period">
          <div>ปีการศึกษา {{ year }} · ภาคเรียน {{ term }}</div>
          <div class="muted">วันที่ออกรายงาน {{ today }}</div>
        </div>
      </div>

      <!-- coverage line -->
      <div class="coverage">
        วัดแล้ว <b>{{ summary.measured }}</b> จาก <b>{{ summary.enrolled }}</b> คน
        ({{ pct(summary.measured, summary.enrolled) }}% ของนักเรียนทั้งหมด)
      </div>

      <!-- primary: WFH category breakdown -->
      <div class="block-title">ภาวะโภชนาการ (น้ำหนักตามเกณฑ์ส่วนสูง)</div>
      <div class="table-wrap">
        <table class="rep">
          <thead>
            <tr>
              <th>ระดับชั้น</th>
              <th v-for="c in WFH_CATEGORIES" :key="c.key">{{ c.label }}</th>
              <th>รวมที่วัด</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in summary.byGrade" :key="g.grade">
              <td class="rowlabel">{{ g.grade }}</td>
              <td v-for="(n, i) in g.counts" :key="i">{{ n }}</td>
              <td class="num">{{ g.counts.reduce((a, b) => a + b, 0) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="rowlabel">รวมทั้งโรงเรียน</td>
              <td v-for="(n, i) in catTotals" :key="i"><b>{{ n }}</b></td>
              <td class="num"><b>{{ summary.measured }}</b></td>
            </tr>
            <tr class="pctrow">
              <td class="rowlabel">ร้อยละ</td>
              <td v-for="(n, i) in catTotals" :key="i">
                <span class="pill" :class="WFH_CATEGORIES[i].cls">{{ pct(n, summary.measured) }}%</span>
              </td>
              <td class="num">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- secondary: สูงดีสมส่วน -->
      <div class="block-title">สูงดีสมส่วน</div>
      <div class="tall-line">
        นักเรียนที่ <b>สูงดีสมส่วน</b> {{ tallTotal }} คน
        คิดเป็น <b>{{ pct(tallTotal, summary.measured) }}%</b> ของนักเรียนที่วัดในรอบนี้
        <div class="bar"><div class="bar-fill" :style="{ width: pct(tallTotal, summary.measured) + '%' }"></div></div>
      </div>

      <!-- BRD §6.3 notice -->
      <p class="notice">หมายเหตุ: ระดับชั้นในรายงานคือชั้นปัจจุบันของนักเรียน (ตามทะเบียนล่าสุด)</p>

      <!-- criteria footer (REQ-8.2) -->
      <div class="doc-foot">
        <div>แหล่งเกณฑ์: {{ CRITERIA.source }}</div>
        <div>{{ CRITERIA.version }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filterbar {
  display: flex; align-items: flex-end; gap: var(--s3); flex-wrap: wrap; margin-bottom: var(--s5);
}
.filterbar .field { margin: 0; }
.filterbar .spacer { flex: 1; }

/* the printable document */
.doc {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--r);
  box-shadow: var(--shadow-sm); padding: var(--s6);
}
.doc-head { display: flex; justify-content: space-between; gap: var(--s4); flex-wrap: wrap;
  padding-bottom: var(--s4); border-bottom: 2px solid var(--ink); margin-bottom: var(--s5); }
.doc-title { font-size: 20px; font-weight: 800; }
.doc-school { color: var(--ink-muted); margin-top: 2px; }
.doc-period { text-align: right; font-weight: 600; }
.doc-period .muted { color: var(--ink-muted); font-weight: 400; font-size: 13px; }

.coverage { background: var(--brand-tint); color: var(--brand-ink); border-radius: var(--r-sm);
  padding: var(--s3) var(--s4); margin-bottom: var(--s5); }

.block-title { font-size: 15px; font-weight: 700; margin: var(--s5) 0 var(--s3); }

table.rep { width: 100%; border-collapse: collapse; font-size: 14px; }
table.rep th, table.rep td { padding: 9px 10px; text-align: center; border-bottom: 1px solid var(--line-soft); }
table.rep th { color: var(--ink-muted); font-weight: 600; font-size: 12.5px; }
table.rep .rowlabel { text-align: left; font-weight: 600; }
table.rep tfoot td { border-top: 2px solid var(--line); border-bottom: none; }
table.rep .pctrow td { padding-top: 6px; }

.tall-line { font-size: 15px; }
.bar { height: 12px; background: var(--surface-2); border-radius: 999px; overflow: hidden; margin-top: var(--s3); max-width: 420px; }
.bar-fill { height: 100%; background: var(--good); border-radius: 999px; transform-origin: left; animation: grow-x 700ms var(--ease) both; }

.notice { color: var(--ink-muted); font-size: 13px; margin-top: var(--s5); }
.doc-foot { margin-top: var(--s5); padding-top: var(--s4); border-top: 1px solid var(--line);
  color: var(--ink-muted); font-size: 12.5px; line-height: 1.6; }
</style>
