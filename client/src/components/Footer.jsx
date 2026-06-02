export default function Footer() {
  return (
    <footer style={{
      marginTop: 64,
      paddingTop: 24,
      borderTop: '1px solid var(--line-soft)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      fontFamily: 'var(--f-mono)',
      fontSize: 12,
      color: 'var(--ink-3)',
      letterSpacing: '0.04em',
    }}>
      <span>© 2026 BC Petroleum · All rights reserved</span>
      <span>Powered by Wudh Boonchan</span>
    </footer>
  );
}
