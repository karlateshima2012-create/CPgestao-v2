/**
 * Copies text to the clipboard, handling both secure and insecure contexts.
 * Uses navigator.clipboard if available, otherwise falls back to document.execCommand.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for non-secure contexts (like HTTP LAN access)
            const textArea = document.createElement("textarea");
            textArea.value = text;

            // Ensure it's not visible but part of the DOM
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);

            textArea.focus();
            textArea.select();

            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            } catch (err) {
                document.body.removeChild(textArea);
                console.error('Fallback: Oops, unable to copy', err);
                return false;
            }
        }
    } catch (err) {
        console.error('Failed to copy text: ', err);
        return false;
    }
};
