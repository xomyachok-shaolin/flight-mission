// pages/_app.jsx
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button, ConfigProvider } from "antd";
import ruRU from "antd/es/locale/ru_RU";
import { ExportOutlined } from "@ant-design/icons";
import { downloadKml } from "../utils/kmlUtils";
import { RouteProvider, useRoute } from "../context/RouteContext";

function HeaderActions() {
  const { routeGeoJson } = useRoute();
  if (!routeGeoJson) return null; // показываем только когда есть маршрут
  return (
    <Button
      type="primary"
      icon={<ExportOutlined />}
      onClick={() => {console.log('Route GeoJSON being passed to downloadKml:', routeGeoJson);
        downloadKml(routeGeoJson)}}
    >
      Экспорт
    </Button>
  );
}

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
    <RouteProvider>
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
                <img
                  src="logo.png"
                  alt="Logo"
                  style={{ width: "56px", height: "auto" }}
                />
                {title}
              </div>
            )}
            rightContentRender={() => <HeaderActions />}
          >
            <Component {...pageProps} />
          </ProLayout>
        )}
      </ConfigProvider>
    </RouteProvider>
  );
}
