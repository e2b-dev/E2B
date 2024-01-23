export function estimateContentLength(formData: FormData) {
    const baseLength = 50; // estimated max value
    const separatorLength = 115; // estimated max value
    let length = baseLength;
    const entries = formData.entries();
    for (const [key, value] of entries) {
        length += key.length + separatorLength;
        if (typeof value === 'object') {
            length += value.size;
        } else {
            length += String(value).length;
        }
    }
    return length;
}
