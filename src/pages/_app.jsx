// pages/_app.jsx
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ConfigProvider } from "antd";
import ruRU from "antd/es/locale/ru_RU";

// динамически грузим ProLayout только на клиенте, чтобы не было рассинхронизации классов
const ProLayout = dynamic(
  () => import("@ant-design/pro-layout").then((mod) => mod.default),
  { ssr: false }
);

export default function MyApp({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ConfigProvider locale={ruRU}>
      {mounted && (
        <ProLayout
          title="Полётное задание"
          logo="logo.png"
          layout="top"
          navTheme="light"
          fixedHeader={false}      // чтобы не дергалось поведение хэдера после гидратации
          menuHeaderRender={(logo, title) => (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingLeft: 10,
              }}
            >
              <img src="logo.png" alt="Logo" style={{ width: "56px", height: "auto" }}  />
              {title}
            </div>
          )}
        >
          <Component {...pageProps} />
        </ProLayout>
      )}
    </ConfigProvider>
  );
}
