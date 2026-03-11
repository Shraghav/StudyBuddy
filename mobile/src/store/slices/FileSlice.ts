import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface FileDetail {
  id: string; 
  uri: string;
  name: string;
  size?: number;
  uploadDate: string;
}

interface FileState {
  files: FileDetail[];
}

const initialState: FileState = {
  files: [],
};

const fileSlice = createSlice({
  name: "files",
  initialState,
  reducers: {
    setFiles: (state, action: PayloadAction<FileDetail[]>) => {
      state.files = action.payload;
    },
    addFiles: (state, action: PayloadAction<FileDetail[]>) => {
      state.files = [...state.files, ...action.payload];
    },
    removeMultipleFiles: (state, action: PayloadAction<string[]>) => {
      state.files = state.files.filter((file) => !action.payload.includes(file.id));
    },
    updateFileName: (
      state,
      action: PayloadAction<{ id: string; newName: string; }>,
    ) => {
      const file = state.files.find((f) => f.id === action.payload.id);
      if (file) {
        file.name = action.payload.newName;
      }
    },
  },
});

export const { setFiles, addFiles, removeMultipleFiles, updateFileName } =
  fileSlice.actions;
export default fileSlice.reducer;
