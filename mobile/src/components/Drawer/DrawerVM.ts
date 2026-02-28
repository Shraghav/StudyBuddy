import { useNavigation } from "@react-navigation/native";
import { DrawerActions } from "@react-navigation/native";

export const DrawerVM = () => {
  const navigation = useNavigation();
  const openSidebar = () => {
    navigation.dispatch(DrawerActions.openDrawer());
    };
    return {openSidebar}
};
