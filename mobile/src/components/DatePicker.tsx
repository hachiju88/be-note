import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useState } from "react";

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
};

export function DatePicker({ value, onChange, minimumDate }: Props) {
  const [show, setShow] = useState(false);

  const label = value
    ? `${value.getFullYear()}/${String(value.getMonth() + 1).padStart(2, "0")}/${String(value.getDate()).padStart(2, "0")}`
    : "日付を選択";

  function handleChange(_: unknown, date?: Date) {
    setShow(Platform.OS === "ios");
    if (date) onChange(date);
  }

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={() => setShow(true)}>
        <Text style={[styles.btnText, !value && styles.placeholder]}>{label}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "calendar"}
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  btnText: {
    fontSize: 14,
    color: "#1e293b",
  },
  placeholder: {
    color: "#94a3b8",
  },
});
