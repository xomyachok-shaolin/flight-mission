import React from "react";
import ProLayout, { PageContainer } from "@ant-design/pro-layout";
import { ConfigProvider } from "antd";
import ruRU from "antd/es/locale/ru_RU";

import MapComponent from "./MapComponent";

const App = () => {
  return (
    // ConfigProvider для локализации Ant Design на русский язык
    <ConfigProvider locale={ruRU}>
      <ProLayout
        title="Полётное задание"
        logo="logo.png"
        layout="top"
        navTheme="light"
        // Можно настроить меню, если потребуется
        menuHeaderRender={(logo, title) => (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingLeft: 10
            }}
          >
              <img
              src="logo.png"
              alt="Logo"
              style={{ width: "56px", height: "auto" }} // увеличили ширину логотипа до 100px
            />
            {title}
          </div>
        )}
      >
        <PageContainer
          header={{
            title: "",
          }}
        >
          <MapComponent />
        </PageContainer>
      </ProLayout>
    </ConfigProvider>
  );
};

export default App;
