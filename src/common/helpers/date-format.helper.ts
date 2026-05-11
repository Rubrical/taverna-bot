export function dateFormatHelperYearMonthDay(date: Date | string | null | undefined): string {
    if (!date) {
        return 'Unavailable';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return 'Unavailable';
    }

    const year = parsedDate.getUTCFullYear();
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getUTCDate()).padStart(2, '0');

    return `${year}/${month}/${day}`;
}