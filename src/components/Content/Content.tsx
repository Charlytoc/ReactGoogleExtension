import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { cacheLocation } from "../../utils/lib";
import {
  UnstyledButton,
  Text,
  Stack,
  SimpleGrid,
  Divider,
  Group,
} from "@mantine/core";
import {
  IconMessageCircle,
  IconCode,
  IconScissors,
  IconNote,
  IconListCheck,
} from "@tabler/icons-react";
import "./Content.css";

type NavItem = {
  label: string;
  icon: React.ReactNode;
  path: string;
};

export const Content = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const go = (path: string) => {
    cacheLocation(path);
    navigate(path);
  };

  const tools: NavItem[] = [
    { label: t("formatters"), icon: <IconCode size={22} />, path: "/formatters" },
    { label: t("snippets"), icon: <IconScissors size={22} />, path: "/snapties" },
    { label: t("notes"), icon: <IconNote size={22} />, path: "/notes" },
    { label: t("tasks"), icon: <IconListCheck size={22} />, path: "/tasks" },
  ];

  return (
    <Stack gap="md" p="md" className="content-home">
      {/* Hero — Chat */}
      <UnstyledButton
        className="nav-card nav-card--hero"
        onClick={() => go("/chat")}
      >
        <Group gap="sm" justify="center">
          <IconMessageCircle size={24} />
          <Text fw={600} size="lg">
            {t("chat")}
          </Text>
        </Group>
      </UnstyledButton>

      {/* Divider */}
      <Divider
        label={
          <Text size="xs" c="dimmed" tt="uppercase" fw={500} lts={1}>
            {t("tools")}
          </Text>
        }
        labelPosition="center"
      />

      {/* Tool grid — 2 columns */}
      <SimpleGrid cols={2} spacing="sm">
        {tools.map((item) => (
          <UnstyledButton
            key={item.path}
            className="nav-card"
            onClick={() => go(item.path)}
          >
            <Stack align="center" gap={6}>
              {item.icon}
              <Text size="sm" fw={500}>
                {item.label}
              </Text>
            </Stack>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Stack>
  );
};
