import { styled } from '@mui/material/styles';
import { useTranslation } from 'next-i18next';

const FooterContainer = styled('div')`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100vw;
  height: max-content;
  bottom: 0;
  left: 0;
  z-index: 80;
  padding-bottom: 8px;
`;

function Footer() {
  const { t } = useTranslation();
  return (
    <FooterContainer>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', letterSpacing: 1 }}>
        COMMANDER MODE © {new Date().getFullYear()}
      </div>
    </FooterContainer>
  );
}

export default Footer;
