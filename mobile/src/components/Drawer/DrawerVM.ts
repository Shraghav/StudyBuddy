import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useTheme } from "react-native-paper";
import { AppTheme } from "../../utils/themes";

export const DrawerVM = () => {
  const navigation = useNavigation();
  const theme = useTheme<AppTheme>();
  const openSidebar = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };
  return { openSidebar, theme };
};
