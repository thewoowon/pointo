import React from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  companyName?: string;
  contactEmail?: string;
};

const PrivacyPolicyModal = ({visible, onClose, companyName = '룰루랄라 컴퍼니', contactEmail = 'thewoowon@gmail.com'}: Props) => {
  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>개인정보 처리방침</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}>
          <Text style={styles.title}>개인정보 처리방침</Text>
          <Text style={styles.date}>시행일: 2025년 5월 1일</Text>

          <Text style={styles.body}>
            {companyName}(이하 "회사")는 「개인정보 보호법」에 따라 이용자의
            개인정보를 보호하고 이와 관련한 고충을 신속하게 처리하기 위하여 다음과
            같이 개인정보 처리방침을 수립·공개합니다.
          </Text>

          <Text style={styles.sectionTitle}>제1조 (수집하는 개인정보 항목)</Text>
          <Text style={styles.body}>
            회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.{'\n'}
            {'\n'}• 필수 수집 항목: 휴대전화번호{'\n'}• 자동 수집 항목: 서비스
            이용 기록(스탬프 적립·사용 내역, 접속 일시)
          </Text>

          <Text style={styles.sectionTitle}>
            제2조 (개인정보의 수집 및 이용 목적)
          </Text>
          <Text style={styles.body}>
            수집한 개인정보는 다음의 목적으로만 이용됩니다.{'\n'}
            {'\n'}• 회원 식별 및 본인 확인{'\n'}• 스탬프 적립·사용·쿠폰 발급
            서비스 제공{'\n'}• 서비스 이용 통계 및 분석
          </Text>

          <Text style={styles.sectionTitle}>
            제3조 (개인정보의 보유 및 이용 기간)
          </Text>
          <Text style={styles.body}>
            이용자의 개인정보는 수집·이용 목적이 달성된 후 지체 없이 파기합니다.
            다만, 이용자가 회원 탈퇴를 요청할 경우 즉시 파기합니다.
          </Text>

          <Text style={styles.sectionTitle}>
            제4조 (개인정보의 파기 절차 및 방법)
          </Text>
          <Text style={styles.body}>
            회사는 개인정보의 수집·이용 목적이 달성되면 해당 정보를 지체 없이
            파기합니다. 전자적 파일 형태의 정보는 복구할 수 없는 방법으로
            삭제합니다.
          </Text>

          <Text style={styles.sectionTitle}>
            제5조 (이용자의 권리와 행사 방법)
          </Text>
          <Text style={styles.body}>
            이용자는 언제든지 다음의 권리를 행사할 수 있습니다.{'\n'}
            {'\n'}• 개인정보 열람 요청{'\n'}• 개인정보 수정 요청{'\n'}• 회원 탈퇴
            및 개인정보 삭제 요청{'\n'}
            {'\n'}
            회원 탈퇴는 앱 내 고객 화면에서 직접 처리할 수 있습니다.
          </Text>

          <Text style={styles.sectionTitle}>
            제6조 (개인정보의 제3자 제공)
          </Text>
          <Text style={styles.body}>
            회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 법령에
            의해 요구되는 경우는 예외로 합니다.
          </Text>

          <Text style={styles.sectionTitle}>
            제7조 (개인정보 보호책임자)
          </Text>
          <Text style={styles.body}>
            회사는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 이용자의
            불만처리 및 피해구제를 위해 아래와 같이 개인정보 보호책임자를
            지정하고 있습니다.{'\n'}
            {'\n'}• 담당: {companyName}{'\n'}• 이메일: {contactEmail}
          </Text>

          <Text style={styles.sectionTitle}>제8조 (방침의 변경)</Text>
          <Text style={styles.body}>
            이 개인정보 처리방침은 시행일로부터 적용되며, 변경사항이 있을 경우 앱
            내 공지를 통해 알려드립니다.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFAF4',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#F2F4F6',
  },
  headerText: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: '#181818',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
  },
  closeText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: '#D4845A',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 60,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Pretendard-SemiBold',
    color: '#3D2416',
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.5)',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: '#3D2416',
    marginTop: 24,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: 'rgba(61, 36, 22, 0.8)',
    lineHeight: 22,
  },
});

export default PrivacyPolicyModal;
