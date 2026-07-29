export function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function addYearsISO(dateISO: string, years: number) {
    const d = new Date(dateISO + 'T00:00:00');
    d.setFullYear(d.getFullYear() + years);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function fmtDate(dateISO?: string | null) {
    if (!dateISO) return '—';
    return dateISO;
}
