<script setup lang="ts">
/**
 * 实名认证 - 提交人工审核 / 查看审核结果
 *
 * 状态机（member.verifyStatus）：
 * - unverified 未认证：可编辑表单，提交后进入人工审核
 * - pending 审核中：只读展示已提交的完整资料 + 提交时间，不可修改
 * - verified 已认证：只读展示完整资料
 * - rejected 已驳回：展示驳回原因，可修改后重新提交
 *
 * API: submitVerifyApi（POST /api/user/verify，提交进入审核流程）
 *      uploadImageApi（证件图片上传）
 */
import { reactive, ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { submitVerifyApi, uploadImageApi } from '@/api/modules/user'
import { resolveClientImage } from '@/utils/image'
import { dateUtil, validators } from '@/utils'
import { useAppStore } from '@/stores/app'
import { useThemeClass } from '@/composables/useThemeClass'
import { useNavigationBar } from '@/composables/useNavigationBar'

const { themeClass } = useThemeClass()
/** 原生导航栏随主题切换 */
useNavigationBar()
const userStore = useUserStore()
const appStore = useAppStore()

/** 当前认证状态：unverified / pending / verified / rejected */
const verifyStatus = computed(() => userStore.user?.verifyStatus || 'unverified')
/** 是否可编辑（未认证 / 已驳回可重新提交） */
const editable = computed(() => verifyStatus.value === 'unverified' || verifyStatus.value === 'rejected')

const verifyForm = reactive({
  realName: '',
  idCard: '',
  driverLicense: '',
  birthDate: '',
  driverLicenseExpire: '',
  idCardFront: '',
  idCardBack: '',
  driverLicenseFront: '',
  driverLicenseBack: ''
})
const saving = ref(false)
const todayStr = dateUtil.today()

/** 只读展示用的资料（来自 user store，字段与后端 MemberVO 对齐） */
const readonlyInfo = computed<Record<string, any>>(() => {
  const u: any = userStore.user || {}
  return {
    realName: u.realName || '—',
    idCard: u.idCard || '—',
    birthDate: u.birthday || '—',
    driverLicense: u.driverLicenseNo || '—',
    driverLicenseExpire: u.driverLicenseExpireDate || '—',
    idCardFront: u.idCardFrontImg || '',
    idCardBack: u.idCardBackImg || '',
    driverLicenseFront: u.driverLicenseFrontImg || '',
    driverLicenseBack: u.driverLicenseBackImg || '',
    submitTime: u.verifySubmitTime || ''
  }
})

/** 资料是否已填写完整（决定只读态是否展示资料区） */
const hasSubmittedData = computed(() => !!(readonlyInfo.value.idCardFront || readonlyInfo.value.idCardBack || readonlyInfo.value.realName !== '—'))

onShow(async () => {
  // 刷新最新认证状态（后台审核结果回显），再同步表单
  try {
    await userStore.fetchUserInfo()
  } catch (e) {
    console.error('[verify] fetchUserInfo failed:', e)
  }
  syncForm()
})

/** 从用户信息同步表单（字段名与后端 MemberVO 对齐） */
function syncForm() {
  const u: any = userStore.user || {}
  verifyForm.realName = u.realName || ''
  verifyForm.idCard = u.idCard || ''
  verifyForm.driverLicense = u.driverLicenseNo || ''
  verifyForm.birthDate = u.birthday || ''
  verifyForm.driverLicenseExpire = u.driverLicenseExpireDate || ''
  verifyForm.idCardFront = u.idCardFrontImg || ''
  verifyForm.idCardBack = u.idCardBackImg || ''
  verifyForm.driverLicenseFront = u.driverLicenseFrontImg || ''
  verifyForm.driverLicenseBack = u.driverLicenseBackImg || ''
}

function statusText(s?: string): string {
  if (s === 'pending') return '资料审核中，请耐心等待'
  if (s === 'verified') return '已认证通过'
  if (s === 'rejected') return '认证被驳回，请修改后重新提交'
  return '完成认证后可享受更快捷的租车服务'
}

/** 证件图片上传 */
function chooseVerifyImage(field: keyof typeof verifyForm) {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      if (!filePath) return
      uni.showLoading({ title: '上传中...' })
      try {
        const result = await uploadImageApi(filePath)
        verifyForm[field] = result.url
        uni.showToast({ title: '上传成功', icon: 'success' })
      } catch (e) {
        console.error('[verify] upload failed:', e)
      } finally {
        uni.hideLoading()
      }
    }
  })
}

/** 编辑态：预览/上传 */
function onEditImageTap(field: keyof typeof verifyForm) {
  if (verifyForm[field]) preview(field)
  else chooseVerifyImage(field)
}
function preview(field: keyof typeof verifyForm) {
  const url = verifyForm[field]
  if (!url) return
  appStore.openImagePreview([resolveClientImage(url)], 0)
}
/** 只读态：预览已提交图片 */
function previewReadonly(field: keyof typeof readonlyInfo.value) {
  const url = readonlyInfo.value[field]
  if (!url) return
  appStore.openImagePreview([resolveClientImage(url)], 0)
}

/** 提交认证（进入人工审核） */
async function saveVerify() {
  if (!verifyForm.realName.trim()) {
    uni.showToast({ title: '请输入真实姓名', icon: 'none' })
    return
  }
  if (!validators.isIdCard(verifyForm.idCard)) {
    uni.showToast({ title: '请输入正确的身份证号', icon: 'none' })
    return
  }
  if (!verifyForm.driverLicense.trim()) {
    uni.showToast({ title: '请输入驾驶证号', icon: 'none' })
    return
  }
  if (!verifyForm.idCardFront || !verifyForm.idCardBack || !verifyForm.driverLicenseFront || !verifyForm.driverLicenseBack) {
    uni.showToast({ title: '请上传完整的证件照片', icon: 'none' })
    return
  }
  // 出生日期禁未来
  if (verifyForm.birthDate && verifyForm.birthDate > todayStr) {
    uni.showToast({ title: '出生日期不能晚于今天', icon: 'none' })
    return
  }
  // 驾驶证过期禁过去
  if (verifyForm.driverLicenseExpire && verifyForm.driverLicenseExpire < todayStr) {
    uni.showToast({ title: '驾驶证已过期，请更新有效日期', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await submitVerifyApi({
      realName: verifyForm.realName.trim(),
      idCard: verifyForm.idCard.trim(),
      driverLicenseNo: verifyForm.driverLicense.trim(),
      birthDate: verifyForm.birthDate || undefined,
      driverLicenseExpireDate: verifyForm.driverLicenseExpire || undefined,
      idCardFrontImg: verifyForm.idCardFront,
      idCardBackImg: verifyForm.idCardBack,
      driverLicenseFrontImg: verifyForm.driverLicenseFront,
      driverLicenseBackImg: verifyForm.driverLicenseBack
    })
    uni.showToast({ title: '已提交，等待人工审核', icon: 'success' })
    await userStore.fetchUserInfo()
  } catch (e) {
    console.error('[verify] submit failed:', e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="verify-page" :class="themeClass">
    <!-- 当前认证状态 -->
    <view class="status-banner" :class="'s-' + verifyStatus">
      <u-icon
        :name="verifyStatus === 'verified' ? 'checkmark-circle' : verifyStatus === 'pending' ? 'clock' : 'info-circle'"
        :color="verifyStatus === 'verified' ? '#07c160' : verifyStatus === 'pending' ? '#ff9900' : verifyStatus === 'rejected' ? '#ff2e2e' : '#6e6e73'"
        size="40rpx"
      ></u-icon>
      <text class="status-text">{{ statusText(verifyStatus) }}</text>
    </view>

    <!-- 驳回原因 -->
    <view v-if="verifyStatus === 'rejected' && userStore.user?.verifyRejectReason" class="reject-reason">
      <text class="reason-label">驳回原因：</text>
      <text class="reason-text">{{ userStore.user.verifyRejectReason }}</text>
    </view>

    <!-- 审核中 / 已认证：只读展示已提交的完整资料 -->
    <view v-if="!editable && hasSubmittedData" class="card">
      <view class="card-title">已提交的认证资料</view>
      <view class="info-row">
        <text class="info-label">真实姓名</text>
        <text class="info-value">{{ readonlyInfo.realName }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">身份证号</text>
        <text class="info-value">{{ readonlyInfo.idCard }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">出生日期</text>
        <text class="info-value">{{ readonlyInfo.birthDate }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">驾驶证号</text>
        <text class="info-value">{{ readonlyInfo.driverLicense }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">驾驶证有效期</text>
        <text class="info-value">{{ readonlyInfo.driverLicenseExpire }}</text>
      </view>
      <view v-if="readonlyInfo.submitTime" class="info-row">
        <text class="info-label">提交时间</text>
        <text class="info-value">{{ readonlyInfo.submitTime }}</text>
      </view>

      <!-- 证件照片（只读，点击预览大图） -->
      <view class="image-grid">
        <view v-for="img in [
          { key: 'idCardFront', label: '身份证正面' },
          { key: 'idCardBack', label: '身份证反面' },
          { key: 'driverLicenseFront', label: '驾驶证正面' },
          { key: 'driverLicenseBack', label: '驾驶证反面' }
        ]" :key="img.key" class="img-item">
          <view class="img-label">{{ img.label }}</view>
          <view class="img-box" @tap="previewReadonly(img.key as any)">
            <image v-if="readonlyInfo[img.key]" :src="resolveClientImage(readonlyInfo[img.key])" mode="aspectFill" class="img-preview" />
            <text v-else class="img-placeholder">未上传</text>
          </view>
        </view>
      </view>
      <view class="grid-tip">
        <text>点击证件照片可查看大图</text>
      </view>

      <view v-if="verifyStatus === 'pending'" class="pending-tip">
        <text class="pending-tip-text">工作人员将在 1-2 个工作日内完成审核，审核结果会同步到您的账户</text>
      </view>
    </view>

    <!-- 未认证 / 已驳回：编辑表单 -->
    <view v-if="editable" class="card">
      <view class="card-title">{{ verifyStatus === 'rejected' ? '修改认证资料' : '填写认证资料' }}</view>
      <view class="form-item">
        <view class="form-label">真实姓名 <text class="required">*</text></view>
        <u-input v-model="verifyForm.realName" placeholder="请输入真实姓名" border="surround" maxlength="20" />
      </view>
      <view class="form-item">
        <view class="form-label">身份证号 <text class="required">*</text></view>
        <u-input v-model="verifyForm.idCard" placeholder="请输入身份证号" border="surround" maxlength="18" />
      </view>
      <view class="form-item">
        <view class="form-label">出生日期</view>
        <picker mode="date" :value="verifyForm.birthDate" :end="todayStr" @change="(e: any) => verifyForm.birthDate = e.detail.value">
          <view class="picker-value" :class="{ placeholder: !verifyForm.birthDate }">
            {{ verifyForm.birthDate || '请选择出生日期' }}
          </view>
        </picker>
      </view>
      <view class="form-item">
        <view class="form-label">驾驶证号 <text class="required">*</text></view>
        <u-input v-model="verifyForm.driverLicense" placeholder="请输入驾驶证号" border="surround" maxlength="20" />
      </view>
      <view class="form-item">
        <view class="form-label">驾驶证过期日</view>
        <picker mode="date" :value="verifyForm.driverLicenseExpire" :start="todayStr" @change="(e: any) => verifyForm.driverLicenseExpire = e.detail.value">
          <view class="picker-value" :class="{ placeholder: !verifyForm.driverLicenseExpire }">
            {{ verifyForm.driverLicenseExpire || '请选择过期日期' }}
          </view>
        </picker>
      </view>

      <!-- 4 张证件图片 -->
      <view class="image-grid">
        <view v-for="img in [
          { key: 'idCardFront', label: '身份证正面 *' },
          { key: 'idCardBack', label: '身份证反面 *' },
          { key: 'driverLicenseFront', label: '驾驶证正面 *' },
          { key: 'driverLicenseBack', label: '驾驶证反面 *' }
        ] as const" :key="img.key" class="img-item">
          <view class="img-label">{{ img.label }}</view>
          <view class="img-box" @tap="onEditImageTap(img.key as any)">
            <image v-if="verifyForm[img.key]" :src="resolveClientImage(verifyForm[img.key])" mode="aspectFill" class="img-preview" />
            <text v-else class="img-placeholder">+上传</text>
            <!-- 已上传图片的角标提示：可点击预览 -->
            <view v-if="verifyForm[img.key]" class="img-corner-tag">
              <text>点击预览</text>
            </view>
          </view>
          <view v-if="verifyForm[img.key]" class="img-action" @tap="chooseVerifyImage(img.key as any)">更换</view>
        </view>
      </view>
      <view class="grid-tip">
        <text>已上传的照片点击可预览，点击「更换」可重新上传</text>
      </view>

      <u-button type="primary" shape="square" :text="verifyStatus === 'rejected' ? '重新提交认证' : '提交认证'" :loading="saving" @click="saveVerify" />
    </view>

    <!-- 安全提示 -->
    <view class="privacy-tip">
      <u-icon name="lock" color="#6e6e73" size="26rpx"></u-icon>
      <text class="tip-text">证件信息仅用于租车资质审核，我们将严格保护您的隐私</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.verify-page {
  min-height: 100vh;
  background-color: var(--page-bg);
  padding: 24rpx;
  box-sizing: border-box;
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  margin-bottom: 24rpx;

  &.s-verified {
    background-color: rgba(7, 193, 96, 0.1);
    .status-text { color: #07c160; }
  }
  &.s-pending {
    background-color: rgba(255, 153, 0, 0.1);
    .status-text { color: #ff9900; }
  }
  &.s-rejected {
    background-color: rgba(255, 46, 46, 0.1);
    .status-text { color: #ff2e2e; }
  }
  &.s-unverified {
    background-color: rgba(174, 174, 178, 0.1);
    .status-text { color: var(--text-sub); }
  }
}

.status-text {
  font-size: 24rpx;
}

.reject-reason {
  display: flex;
  gap: 8rpx;
  padding: 16rpx 24rpx;
  border-radius: 12rpx;
  background-color: rgba(255, 46, 46, 0.08);
  border: 1rpx solid rgba(255, 46, 46, 0.3);
  margin-bottom: 24rpx;
}

.reason-label {
  font-size: 24rpx;
  color: #ff2e2e;
  flex-shrink: 0;
}

.reason-text {
  font-size: 24rpx;
  color: var(--text-main);
}

.card {
  background-color: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-main);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--border-color);

  &:last-of-type {
    border-bottom: none;
  }
}

.info-label {
  font-size: 26rpx;
  color: var(--text-sub);
  flex-shrink: 0;
}

.info-value {
  font-size: 26rpx;
  color: var(--text-main);
  text-align: right;
  word-break: break-all;
}

.pending-tip {
  padding: 16rpx;
  background-color: rgba(255, 153, 0, 0.06);
  border-radius: 8rpx;
}

.pending-tip-text {
  font-size: 22rpx;
  color: var(--text-sub);
  line-height: 1.6;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.form-label {
  font-size: 26rpx;
  color: var(--text-sub);
}

.required {
  color: #ff2e2e;
}

.picker-value {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  background-color: var(--border-color);
  border-radius: 8rpx;
  font-size: 28rpx;
  color: var(--text-main);

  &.placeholder {
    color: var(--text-dim);
  }
}

.image-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
}

.img-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.img-label {
  font-size: 24rpx;
  color: var(--text-sub);
}

.img-box {
  position: relative;
  width: 100%;
  height: 200rpx;
  background-color: var(--border-color);
  border: 2rpx dashed rgba(128, 128, 128, 0.4);
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

// 已上传图片右下角角标：提示可点击预览
.img-corner-tag {
  position: absolute;
  right: 0;
  bottom: 0;
  padding: 4rpx 12rpx;
  background-color: rgba(0, 0, 0, 0.55);
  border-top-left-radius: 8rpx;

  text {
    font-size: 20rpx;
    color: #fff;
  }
}

// 图片网格下方操作提示
.grid-tip {
  text {
    font-size: 22rpx;
    color: var(--text-dim);
    line-height: 1.6;
  }
}

.img-preview {
  width: 100%;
  height: 100%;
}

.img-placeholder {
  font-size: 36rpx;
  color: var(--text-dim);
}

.img-action {
  font-size: 22rpx;
  color: #ff2e2e;
  text-align: center;
}

.privacy-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin-top: 8rpx;
}

.tip-text {
  font-size: 22rpx;
  color: var(--text-dim);
}
</style>
