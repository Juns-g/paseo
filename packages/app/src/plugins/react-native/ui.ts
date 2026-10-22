export {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SettingsSwitch,
  SettingsSelect,
  SettingsInput,
  SettingsAction,
} from "@/components/settings";

export { ExternalLink } from "@/components/ui/external-link";

export { SidebarRow, SidebarSeparator } from "@/plugins/sidebar-items/kit";

export { DocumentFrame } from "@/file-panels/document-frame";

export { FilePanelLoading as Loading } from "@/file-panels/loading";

// COMPAT(pluginSettingsGroup): added in v0.13.0, remove after 2027-04-20
export { SettingsGroup } from "@/components/settings";

export { Icon } from "../icons";
export { Modal } from "./modal";
export { ScrollView, FlatList } from "./scroll-view";
export { TextInput } from "./text-input";
export { copyText } from "./clipboard";
export { useToast } from "./toast";
// COMPAT(privateBotsReveal): added in v0.13.0, remove after 2027-04-20 once rich-text bots migrate.
export { useRevealedText } from "@/hooks/use-revealed-text";
export { StreamedText } from "./streamed-text";

export { Markdown } from "./markdown";
