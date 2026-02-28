import { DrawerNavigationProp } from "@react-navigation/drawer";
import {
  CompositeNavigationProp,
  NavigatorScreenParams,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

export type AuthStackParamList = {
  SignIn: undefined;
  Signup: undefined;
};

export type QuizStackParamList = {
  QuizSetup: undefined;
  ActiveQuiz: undefined;
  QuizResult: undefined;
};

export type ChatDrawerParamList = {
  ChatScreen: undefined;
};

export type QuizDrawerParamList = {
  QuizStack: NavigatorScreenParams<QuizStackParamList>;
};


export type BottomTabParamList = {
  Upload: undefined;
  Chat: NavigatorScreenParams<ChatDrawerParamList>;
  Quiz: NavigatorScreenParams<QuizDrawerParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  MainApp: NavigatorScreenParams<BottomTabParamList>;
};

export type AuthNavigationProp = NativeStackNavigationProp<AuthStackParamList>;
export type QuizScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<QuizStackParamList>,
  DrawerNavigationProp<QuizDrawerParamList>
>;
