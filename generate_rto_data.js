const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function generateRtoData() {
  console.log('--- RE-GENERATING 2026 JAN-AUG DATASET FROM MASTER_DATA_2026.XLSM FOR PAGES 3 & 4 ---');

  const pythonScript = `
import openpyxl
import json
import os

file_2026 = r"MASTER_DATA_2026.xlsm"
file_master = r"RTO_MASTER.xlsm"

wb_master = openpyxl.load_workbook(file_master, data_only=True)
ws_master = wb_master['MASTER_DATA']

rto_names = {}
for row in list(ws_master.iter_rows(values_only=True))[1:]:
    if row[0]:
        code = str(row[0]).strip().replace(' ', '').upper()
        name = str(row[1]).strip()
        rto_names[code] = name

CLUSTER_MAPPING = {
    'KL1': 'Kazhakkottam & Enchakkal', 'KL16': 'Kazhakkottam & Enchakkal', 'KL19': 'Kazhakkottam & Enchakkal',
    'KL20': 'Kazhakkottam & Enchakkal', 'KL21': 'Kazhakkottam & Enchakkal', 'KL22': 'Kazhakkottam & Enchakkal',
    'KL74': 'Kazhakkottam & Enchakkal', 'KL81': 'Kazhakkottam & Enchakkal',
    
    'KL2': 'Kollam', 'KL23': 'Kollam', 'KL24': 'Kollam', 'KL25': 'Kollam', 'KL80': 'Kollam', 'KL82': 'Kollam',
    'KL3': 'Pathanamthitta', 'KL26': 'Pathanamthitta', 'KL62': 'Pathanamthitta', 'KL83': 'Pathanamthitta',
    'KL4': 'Kayamkulam', 'KL29': 'Kayamkulam', 'KL31': 'Kayamkulam', 'KL61': 'Kayamkulam', 'KL66': 'Kayamkulam',
    'KL5': 'Kottayam', 'KL33': 'Kottayam', 'KL34': 'Kottayam', 'KL35': 'Kottayam', 'KL36': 'Kottayam', 'KL67': 'Kottayam',
    'KL6': 'Muvattupuzha', 'KL17': 'Muvattupuzha', 'KL37': 'Muvattupuzha', 'KL38': 'Muvattupuzha', 'KL44': 'Muvattupuzha', 'KL68': 'Muvattupuzha', 'KL69': 'Muvattupuzha',
    'KL7': 'Kalamassery', 'KL40': 'Kalamassery', 'KL41': 'Kalamassery', 'KL42': 'Kalamassery', 'KL63': 'Kalamassery',
    'KL8': 'Trichur', 'KL46': 'Trichur', 'KL48': 'Trichur', 'KL75': 'Trichur',
    'KL32': 'Nettoor', 'KL39': 'Nettoor', 'KL43': 'Nettoor',
    'KL45': 'Irinjalakuda', 'KL47': 'Irinjalakuda', 'KL64': 'Irinjalakuda',
    'KL27': 'Thiruvalla', 'KL28': 'Thiruvalla', 'KL30': 'Thiruvalla',
}

wb_2026 = openpyxl.load_workbook(file_2026, data_only=True)
ws_2026 = wb_2026['MASTER_DATA_2026']
rows_2026 = list(ws_2026.iter_rows(values_only=True))

header = rows_2026[0]
months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG']
q1_months = ['JAN', 'FEB', 'MAR']
q2_months = ['APR', 'MAY', 'JUN']

records = []
for row in rows_2026[1:]:
    rto_raw = str(row[0]).strip()
    rto_clean = rto_raw.replace(' ', '').upper()
    name = str(row[1]).strip()
    maker = str(row[2]).strip()
    loc = CLUSTER_MAPPING.get(rto_clean, 'Other / Unmapped')
    
    m_vals = {}
    for idx, m in enumerate(months):
        m_vals[m] = int(row[3 + idx]) if row[3 + idx] is not None else 0
        
    records.append({
        'rto': rto_clean,
        'rto_raw': rto_raw,
        'name': rto_names.get(rto_clean, name),
        'maker': maker,
        'loc': loc,
        'm_vals': m_vals
    })

preferred_order = [
    'Alappuzha', 'Irinjalakuda', 'Kalamassery', 'Kayamkulam',
    'Kazhakkottam & Enchakkal', 'Kollam', 'Kottayam', 'Muvattupuzha',
    'Nettoor', 'Other / Unmapped', 'Pathanamthitta', 'Thiruvalla', 'Trichur'
]

loc_keys = sorted(list(set(r['loc'] for r in records)), key=lambda x: preferred_order.index(x) if x in preferred_order else 99)

processed_data = {}

def calc_metrics_from_records(rec_list):
    tiv = 0
    toyota = 0
    for r in rec_list:
        row_sum = sum(r['m_vals'].values())
        tiv += row_sum
        if r['maker'].upper() == 'TOYOTA KIRLOSKAR MOTOR PVT LTD':
            toyota += row_sum
    share = round(toyota / tiv * 100, 1) if tiv > 0 else 0.0
    return {'tiv': tiv, 'toyota': toyota, 'share': share}

def calc_month_metrics(rec_list, m):
    tiv = sum(r['m_vals'][m] for r in rec_list)
    toyota = sum(r['m_vals'][m] for r in rec_list if r['maker'].upper() == 'TOYOTA KIRLOSKAR MOTOR PVT LTD')
    share = round(toyota / tiv * 100, 1) if tiv > 0 else 0.0
    return {'month': m, 'tiv': tiv, 'toyota': toyota, 'share': share}

def calc_q_metrics(rec_list, q_m_list):
    tiv = sum(sum(r['m_vals'][m] for m in q_m_list) for r in rec_list)
    toyota = sum(sum(r['m_vals'][m] for m in q_m_list) for r in rec_list if r['maker'].upper() == 'TOYOTA KIRLOSKAR MOTOR PVT LTD')
    share = round(toyota / tiv * 100, 1) if tiv > 0 else 0.0
    return {'tiv': tiv, 'toyota': toyota, 'share': share}

def get_maker_rankings(rec_list, total_tiv):
    m_sums = {}
    for r in rec_list:
        row_sum = sum(r['m_vals'].values())
        m_sums[r['maker']] = m_sums.get(r['maker'], 0) + row_sum
    rankings = []
    for m, vol in m_sums.items():
        pct = round(vol / total_tiv * 100, 1) if total_tiv > 0 else 0.0
        rankings.append({'maker': m, 'vol': vol, 'pct': pct})
    rankings.sort(key=lambda x: x['vol'], reverse=True)
    return rankings

for loc in loc_keys:
    loc_recs = [r for r in records if r['loc'] == loc]
    sub_codes = list(set(r['rto'] for r in loc_recs))
    
    def sub_sort(c):
        digits = ''.join([ch for ch in c if ch.isdigit()])
        return int(digits) if digits else 999
    sub_codes.sort(key=sub_sort)
    
    disp_name = 'Trivandrum Royals (Kazhakkottam & Enchakkal)' if loc == 'Kazhakkottam & Enchakkal' else loc
    alias_name = 'Trivandrum Royals' if loc == 'Kazhakkottam & Enchakkal' else loc
    
    main_summary = calc_metrics_from_records(loc_recs)
    monthly2026 = [calc_month_metrics(loc_recs, m) for m in months]
    q1_metrics = calc_q_metrics(loc_recs, q1_months)
    q2_metrics = calc_q_metrics(loc_recs, q2_months)
    maker_rankings = get_maker_rankings(loc_recs, main_summary['tiv'])
    
    sub_rtos_processed = []
    for code in sub_codes:
        sub_recs = [r for r in loc_recs if r['rto'] == code]
        sub_summary = calc_metrics_from_records(sub_recs)
        sub_monthly = [calc_month_metrics(sub_recs, m) for m in months]
        sub_q1 = calc_q_metrics(sub_recs, q1_months)
        sub_q2 = calc_q_metrics(sub_recs, q2_months)
        sub_makers = get_maker_rankings(sub_recs, sub_summary['tiv'])
        
        top_maker = sub_makers[0] if sub_makers else {'maker': 'N/A', 'pct': 0.0}
        toyota_obj = next((m for m in sub_makers if 'TOYOTA' in m['maker'].upper()), None)
        toyota_rank = (sub_makers.index(toyota_obj) + 1) if toyota_obj else 'N/A'
        
        note_type = 'note-blue'
        if sub_summary['share'] >= 10.0:
            note_type = 'note-green'
        elif sub_summary['share'] < 7.0:
            note_type = 'note-amber'
            
        full_name = rto_names.get(code, f"{code} RTO")
        note_text = f"2026 Jan-Aug TIV: {sub_summary['tiv']:,} registrations. Top maker: {top_maker['maker']} ({top_maker['pct']}% share). Toyota rank: #{toyota_rank} with {sub_summary['toyota']:,} units ({sub_summary['share']}% market share). Q1 share was {sub_q1['share']}% vs Q2 share of {sub_q2['share']}%."
        
        sub_rtos_processed.append({
            'code': code,
            'name': full_name,
            'tiv2026': sub_summary['tiv'],
            'toyota2026': sub_summary['toyota'],
            'share2026': sub_summary['share'],
            'avgMonthlyLmv': round(sub_summary['tiv'] / 8),
            'avgMonthlyToyota': round(sub_summary['toyota'] / 8, 1),
            'monthly2026': sub_monthly,
            'q1': sub_q1,
            'q2': sub_q2,
            'makers': sub_makers,
            'noteType': note_type,
            'noteText': note_text
        })
        
    toyota_main_obj = next((m for m in maker_rankings if 'TOYOTA' in m['maker'].upper()), None)
    toyota_main_rank = (maker_rankings.index(toyota_main_obj) + 1) if toyota_main_obj else 'N/A'
    
    main_insight = f"{disp_name} cluster recorded {main_summary['tiv']:,} total industry registrations in 2026 Jan-Aug across {len(sub_codes)} sub-RTOs. Toyota ranks #{toyota_main_rank} overall with {main_summary['toyota']:,} units ({main_summary['share']}% market share). Q1 share stood at {q1_metrics['share']}% compared to {q2_metrics['share']}% in Q2."
    
    cluster_obj = {
        'id': loc,
        'name': disp_name,
        'alias': alias_name,
        'scope': '2026 JAN–AUG ONLY',
        'subRtoCodes': sub_codes,
        'summary': {
            'tiv2026': main_summary['tiv'],
            'toyota2026': main_summary['toyota'],
            'share2026': main_summary['share'],
            'avgMonthlyLmv': round(main_summary['tiv'] / 8),
            'avgMonthlyToyota': round(main_summary['toyota'] / 8, 1)
        },
        'monthly2026': monthly2026,
        'q1': q1_metrics,
        'q2': q2_metrics,
        'makers': maker_rankings,
        'insight': main_insight,
        'subRtos': sub_rtos_processed
    }
    
    processed_data[loc] = cluster_obj

if 'Kazhakkottam & Enchakkal' in processed_data:
    processed_data['Trivandrum Royals'] = processed_data['Kazhakkottam & Enchakkal']

print(json.dumps(processed_data))
`;

  try {
    const scratchDir = path.join(__dirname, 'scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
    const pyPath = path.join(scratchDir, 'run_gen.py');
    fs.writeFileSync(pyPath, pythonScript);
    const output = execSync(`python "${pyPath}"`, { maxBuffer: 15 * 1024 * 1024 });
    const processedData = JSON.parse(output.toString());
    
    fs.writeFileSync(path.join(__dirname, 'rto_data.json'), JSON.stringify(processedData, null, 2));
    console.log('Successfully written rto_data.json with 2026 JAN-AUG data from MASTER_DATA_2026.xlsm!');
  } catch (err) {
    console.error('Data generation failed:', err.message);
    process.exit(1);
  }
}

generateRtoData().catch(err => {
  console.error('Data generation failed:', err);
  process.exit(1);
});
